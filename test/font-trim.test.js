import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer';
import { buildCommand } from '../src/commands/build.js';
import { hasFontFaces, trimUnusedFontFaces } from '../src/html/fonts.js';

describe('font trimming', () => {
  it('detects @font-face presence', () => {
    assert.equal(hasFontFaces('@font-face { font-family: A; src: url(data:font/woff2;base64,AA) }'), true);
    assert.equal(hasFontFaces('body { color: red }'), false);
  });

  it('removes unused faces and keeps used ones by index', () => {
    const css = [
      "@font-face { font-family: 'A'; font-weight: normal; font-style: normal; src: url(data:font/woff2;base64,AAAA) }",
      "@font-face { font-family: 'B'; font-weight: normal; font-style: normal; src: url(data:font/woff2;base64,BBBB) }",
    ].join('\n');
    const screen = [
      { family: 'A', weight: 'normal', style: 'normal', status: 'loaded' },
      { family: 'B', weight: 'normal', style: 'normal', status: 'unloaded' },
    ];
    const result = trimUnusedFontFaces(css, screen, screen);
    assert.equal(result.removed, 1);
    assert.ok(result.css.includes('base64,AAAA'));
    assert.ok(!result.css.includes('base64,BBBB'));
  });

  it('trims unicode-range subsets individually despite identical descriptors', () => {
    const css = [
      "@font-face { font-family: 'S'; font-weight: 400; font-style: normal; src: url(data:font/woff2;base64,LATIN) format('woff2'); unicode-range: U+0000-00FF; }",
      "@font-face { font-family: 'S'; font-weight: 400; font-style: normal; src: url(data:font/woff2;base64,CYRILLIC) format('woff2'); unicode-range: U+0400-04FF; }",
    ].join('\n');
    const screen = [
      { family: 'S', weight: '400', style: 'normal', status: 'loaded' },
      { family: 'S', weight: '400', style: 'normal', status: 'unloaded' },
    ];
    const result = trimUnusedFontFaces(css, screen, screen);
    assert.equal(result.removed, 1);
    assert.ok(result.css.includes('LATIN'));
    assert.ok(!result.css.includes('CYRILLIC'));
  });

  it('keeps everything when the browser-reported face count does not match', () => {
    const css = "@font-face { font-family: 'A'; src: url(data:font/woff2;base64,AAAA) }";
    const result = trimUnusedFontFaces(css, [], []);
    assert.equal(result.removed, 0);
    assert.equal(result.kept, 1);
    assert.ok(result.css.includes('base64,AAAA'));
  });

  it('keeps everything when @font-face rules are media-dependent', () => {
    const css = [
      "@media screen { @font-face { font-family: 'C'; src: url(data:font/woff2;base64,CYR); unicode-range: U+0400-04FF; } }",
      "@font-face { font-family: 'C'; src: url(data:font/woff2;base64,LAT); unicode-range: U+0000-00FF; }",
      "p { font-family: serif }",
      "@media print { p { font-family: 'C' } }",
    ].join('\n');
    const screen = [
      { family: 'C', weight: 'normal', style: 'normal', status: 'unloaded' },
      { family: 'C', weight: 'normal', style: 'normal', status: 'unloaded' },
    ];
    const print = [
      { family: 'C', weight: 'normal', style: 'normal', status: 'loaded' },
    ];
    const result = trimUnusedFontFaces(css, screen, print);
    assert.equal(result.removed, 0);
    assert.ok(result.css.includes('LAT'));
  });

  it('keeps fonts referenced only inside media queries', () => {
    const css = [
      "@font-face { font-family: 'Wide'; src: url(data:font/woff2;base64,WIDE) }",
      "p { font-family: serif }",
      "@media screen and (min-width: 1000px) { p { font-family: 'Wide' } }",
    ].join('\n');
    const faces = [
      { family: 'Wide', weight: 'normal', style: 'normal', status: 'unloaded' },
    ];
    const result = trimUnusedFontFaces(css, faces, faces);
    assert.equal(result.removed, 0);
    assert.ok(result.css.includes('WIDE'));
  });

  for (const family of ['Wide Book', 'Wide\\ Book', '"Wide Book", serif']) {
    it(`keeps conditional family ${family}`, () => {
      const css = `@font-face { font-family: 'Wide Book'; src: url(data:font/woff2;base64,WIDE) }
        @media (min-width: 1000px) { p { font-family: ${family} } }`;
      const faces = [{ family: 'Wide Book', weight: '400', style: 'normal', status: 'unloaded' }];
      assert.equal(trimUnusedFontFaces(css, faces, faces).removed, 0);
    });
  }

  for (const property of ['font-weight', 'font-style', 'font-stretch', 'font-variation-settings']) {
    it(`keeps fonts when conditional ${property} can select another face`, () => {
      const css = `@font-face { font-family: Book; src: url(data:font/woff2;base64,AAAA) }
        p { font-family: Book }
        @media (min-width: 1000px) { p { ${property}: inherit } }`;
      const faces = [{ family: 'Book', weight: '400', style: 'normal', status: 'unloaded' }];
      assert.equal(trimUnusedFontFaces(css, faces, faces).removed, 0);
    });
  }

  it('keeps fonts whose selection depends on custom properties', () => {
    const faces = [{ family: 'Book', weight: '400', style: 'normal', status: 'unloaded' }];
    for (const css of [
      '@font-face { font-family: Book; src: url(data:font/woff2;base64,AAAA) } p { font-family: var(--family) }',
      '@font-face { font-family: Book; src: url(data:font/woff2;base64,AAAA) } @media (min-width: 1000px) { :root { --weight: 700 } }',
    ]) {
      assert.equal(trimUnusedFontFaces(css, faces, faces).removed, 0);
    }
  });

  it('keeps fonts selected by interaction, including nested selectors', () => {
    const faces = [{ family: 'Book', weight: '400', style: 'normal', status: 'unloaded' }];
    const css = `@font-face { font-family: Book; src: url(data:font/woff2;base64,AAAA) }
      .note { &:hover { p { font-weight: 700 } } }`;
    assert.equal(trimUnusedFontFaces(css, faces, faces).removed, 0);
  });
});

function project(t, themeCss, toml = '[output]\nhtml = true\npdf = false') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'markpublisher-fonts-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, 'themes/default'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'themes/default/theme.css'), themeCss);
  fs.writeFileSync(path.join(dir, 'markpublisher.toml'), toml);
  fs.writeFileSync(path.join(dir, 'book.md'), '# Book\n\nText');
  return dir;
}

const THEME_WITH_FONTS = [
  "@font-face { font-family: 'Used'; font-weight: normal; font-style: normal; src: url(data:font/woff2;base64,AAAA) format('woff2'); }",
  "@font-face { font-family: 'Unused'; font-weight: normal; font-style: normal; src: url(data:font/woff2;base64,BBBB) format('woff2'); }",
  "body { font-family: 'Used', serif; }",
  '.page { width: 210mm; height: 297mm; }',
].join('\n');

describe('build font trimming', () => {
  it('trims fonts not used by the rendered document', async t => {
    const dir = project(t, THEME_WITH_FONTS);
    const faces = [
      { family: 'Used', weight: 'normal', style: 'normal', status: 'loaded' },
      { family: 'Unused', weight: 'normal', style: 'normal', status: 'unloaded' },
    ];
    const result = await buildCommand({ cwd: dir, fontDetector: async () => ({ screen: faces, print: faces }) });
    const html = fs.readFileSync(result.htmlPath, 'utf8');
    assert.ok(html.includes('base64,AAAA'));
    assert.ok(!html.includes('base64,BBBB'));
  });

  it('keeps all fonts and warns when trimming fails', async t => {
    const dir = project(t, THEME_WITH_FONTS);
    const result = await buildCommand({ cwd: dir, fontDetector: async () => { throw new Error('no chromium'); } });
    const html = fs.readFileSync(result.htmlPath, 'utf8');
    assert.ok(html.includes('base64,AAAA'));
    assert.ok(html.includes('base64,BBBB'));
    assert.ok(result.warnings.some(w => w.includes('Font trimming skipped')));
  });

  it('skips detection entirely when the theme has no @font-face', async t => {
    const dir = project(t, 'body { color: red }\n.page { width: 210mm; height: 297mm; }');
    let called = false;
    await buildCommand({ cwd: dir, fontDetector: async () => { called = true; return { screen: [], print: [] }; } });
    assert.equal(called, false);
  });

  it('respects trimUnusedFonts = false', async t => {
    const dir = project(t, THEME_WITH_FONTS, '[output]\nhtml = true\npdf = false\n[build]\ntrimUnusedFonts = false');
    let called = false;
    await buildCommand({ cwd: dir, fontDetector: async () => { called = true; return { screen: [], print: [] }; } });
    assert.equal(called, false);
  });
});

describe('responsive fonts in built HTML', () => {
  const scenarios = [
    { name: 'unquoted multi-word family', family: 'Wide Book', declaration: 'font-family: Wide Book', base: 'font-family: serif', descriptor: '' },
    { name: 'escaped family', family: 'Wide Book', declaration: 'font-family: Wide\\ Book', base: 'font-family: serif', descriptor: '' },
    { name: 'bold face', family: 'Book', declaration: 'font-weight: 700', base: 'font-family: Book; font-weight: 400', descriptor: 'font-weight: 700', key: 'weight', value: '700' },
    { name: 'italic face', family: 'Book', declaration: 'font-style: italic', base: 'font-family: Book; font-style: normal', descriptor: 'font-style: italic', key: 'style', value: 'italic' },
    { name: 'condensed face', family: 'Book', declaration: 'font-stretch: condensed', base: 'font-family: Book; font-stretch: normal', descriptor: 'font-stretch: condensed', key: 'stretch', value: 'condensed' },
    { name: 'variable-driven family', family: 'Wide Book', declaration: '--book-family: "Wide Book"', base: 'font-family: var(--book-family, serif)', descriptor: '' },
  ];

  for (const scenario of scenarios) {
    it(`preserves ${scenario.name} after resizing the final HTML`, { timeout: 30000 }, async t => {
      const systemFont = [
        '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
        '/usr/share/fonts/liberation/LiberationSans-Regular.ttf',
        '/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf',
      ].find(file => fs.existsSync(file));
      if (!systemFont) return t.skip('Test system font unavailable');
      const regularFace = scenario.descriptor ? `@font-face { font-family: '${scenario.family}'; src: url(book.ttf) }` : '';
      const css = `${regularFace}
        @font-face { font-family: '${scenario.family}'; src: url(book.ttf); ${scenario.descriptor} }
        .page { width: 210mm; height: 297mm }
        p { ${scenario.base} }
        @media screen and (min-width: 1000px) { p { ${scenario.declaration} } }`;
      const dir = project(t, css);
      fs.copyFileSync(systemFont, path.join(dir, 'themes/default/book.ttf'));
      // Run the real detector and inspect the final file, not mocked face reports.
      const result = await buildCommand({ cwd: dir });
      assert.deepEqual(result.warnings, []);
      assert.match(fs.readFileSync(result.htmlPath, 'utf8'), /@font-face/);
      const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
      t.after(() => browser.close());
      const page = await browser.newPage();
      await page.goto(pathToFileURL(result.htmlPath).href, { waitUntil: 'load' });
      const loaded = () => page.evaluate(async ({ family, key, value }) => {
        document.body.offsetHeight;
        await document.fonts.ready;
        return [...document.fonts].filter(face => face.status === 'loaded'
          && face.family === family && (!key || face[key] === value)).map(face => face.family);
      }, scenario);
      assert.deepEqual(await loaded(), []);
      await page.setViewport({ width: 1200, height: 800 });
      assert.ok((await loaded()).includes(scenario.family));
    });
  }
});
