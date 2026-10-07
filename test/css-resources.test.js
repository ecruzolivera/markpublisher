import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer';
import { createAssetBundler } from '../src/html/assets.js';
import { createResourceLoader } from '../src/html/resources.js';
import { parseThemeCss } from '../src/themes/loader.js';

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'markpublisher-css-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const warnings = [];
  return { dir, warnings, bundler: createAssetBundler({ outputDir: dir, warnings }) };
}

describe('CSS structure and resources', () => {
  it('reads dimensions independently of order and reports invalid declarations', () => {
    for (const css of ['.page { height:9in; width:6in }', '.page { width:5in; padding:1in; width:6in; /* x */ height:9in }',
      '.page { width:6in !important; width:5in; height:9in }', '.page { HEIGHT:9in; WIDTH:6in }']) {
      assert.deepEqual(parseThemeCss(css), { width: '6in', height: '9in' });
    }
    assert.deepEqual(parseThemeCss('@page { size: 6in 9in }'), { width: '6in', height: '9in' });
    assert.deepEqual(parseThemeCss('@PAGE { SIZE:A5 !important; size:A4 }'), { format: 'A5' });
    const warnings = [];
    parseThemeCss('.page { width: var(--width); height: 9in }', warnings);
    assert.match(warnings[0], /Unsupported .page dimensions/);
  });

  it('preserves conditional imports in actual screen/print rendering', async t => {
    const { dir, warnings, bundler } = fixture(t);
    const theme = path.join(dir, 'source.css');
    fs.writeFileSync(theme, '@IMPORT "print.css" print; @import "layer.css" LAYER(book) SUPPORTS(display: grid);');
    fs.writeFileSync(path.join(dir, 'print.css'), 'body { color: rgb(255, 0, 0) }');
    fs.writeFileSync(path.join(dir, 'layer.css'), 'body { display: grid }');
    const css = await bundler.bundleCss(fs.readFileSync(theme, 'utf8'), { type: 'local', path: theme });
    assert.match(css, /@media print/);
    assert.match(css, /@layer book/);
    assert.match(css, /@supports \(display: grid\)/);
    const html = path.join(dir, 'test.html');
    fs.writeFileSync(html, `<html><head><link rel="stylesheet" href="${bundler.writeBundledCss(css)}"></head><body>Text</body></html>`);
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    t.after(() => browser.close());
    const page = await browser.newPage();
    await page.goto(pathToFileURL(html).href);
    assert.equal(await page.evaluate(() => getComputedStyle(document.body).color), 'rgb(0, 0, 0)');
    assert.equal(await page.evaluate(() => getComputedStyle(document.body).display), 'grid');
    await page.emulateMediaType('print');
    assert.equal(await page.evaluate(() => getComputedStyle(document.body).color), 'rgb(255, 0, 0)');
    assert.deepEqual(warnings, []);
  });

  it('terminates cycles and deep imports but allows repeated independent imports', async t => {
    const { dir, warnings, bundler } = fixture(t);
    const a = path.join(dir, 'a.css');
    fs.writeFileSync(a, '@import "b.css"; .a { color: red }');
    fs.writeFileSync(path.join(dir, 'b.css'), '@import "a.css"; .b { color: blue }');
    const cyclic = await bundler.bundleCss(fs.readFileSync(a, 'utf8'), { type: 'local', path: a });
    assert.match(cyclic, /\.a/);
    assert.match(cyclic, /\.b/);
    assert.ok(warnings.some(w => /cycle.*a.css.*b.css.*a.css/.test(w)));
    fs.writeFileSync(path.join(dir, 'repeat.css'), '.repeat { color: red }');
    const before = warnings.length;
    const repeated = await bundler.bundleCss('@import "repeat.css"; @import "repeat.css";', { type: 'local', path: a });
    assert.equal((repeated.match(/\.repeat/g) || []).length, 2);
    assert.equal(warnings.length, before);
    for (let i = 0; i < 34; i++) fs.writeFileSync(path.join(dir, `${i}.css`), i < 33 ? `@import "${i + 1}.css";` : '.end {}');
    await bundler.bundleCss('@import "1.css";', { type: 'local', path: path.join(dir, '0.css') });
    assert.ok(warnings.some(w => w.includes('depth limit')));
  });

  it('shares in-flight downloads and handles HTML quoting and fragments', async t => {
    const { dir } = fixture(t);
    let calls = 0;
    const warnings = [];
    const bundler = createAssetBundler({ outputDir: dir, warnings, fetchImpl: async () => {
      calls++;
      await delay(5);
      return new Response('<svg/>', { headers: { 'content-type': 'image/svg+xml' } });
    } });
    const html = await bundler.bundleHtml('<img src=\'https://example.test/icon.svg#one\'><img src=https://example.test/icon.svg#two><img src="data:image/png;base64,AA==">');
    assert.equal(calls, 1);
    assert.match(html, /assets\/icon.svg#one/);
    assert.match(html, /assets\/icon.svg#two/);
    assert.match(html, /data:image\/png/);
    assert.deepEqual(warnings, []);
  });

  it('retains each cached import origin and detects cycles through HTTP redirects', async t => {
    const { dir, bundler, warnings } = fixture(t);
    fs.mkdirSync(path.join(dir, 'one'));
    fs.mkdirSync(path.join(dir, 'two'));
    const shared = path.join(dir, 'shared.css');
    fs.writeFileSync(shared, '.shared { background:url("image.svg") }');
    for (const name of ['one', 'two']) {
      fs.symlinkSync(shared, path.join(dir, name, 'alias.css'));
      fs.writeFileSync(path.join(dir, name, 'image.svg'), `<svg>${name}</svg>`);
    }
    await bundler.bundleCss('@import "one/alias.css"; @import "two/alias.css";', { type: 'local', path: path.join(dir, 'theme.css') });
    const assets = fs.readdirSync(path.join(dir, 'assets')).map(name => fs.readFileSync(path.join(dir, 'assets', name), 'utf8'));
    assert.deepEqual(new Set(assets), new Set(['<svg>one</svg>', '<svg>two</svg>']));
    let fetches = 0;
    const redirected = createAssetBundler({ outputDir: dir, warnings, fetchImpl: async () => {
      fetches++;
      return {
        ok: true, url: 'https://example.test/final.css', headers: new Headers({ 'content-type': 'text/css' }),
        arrayBuffer: async () => Buffer.from('@import "https://example.test/start.css"; .redirected { color:red }'),
      };
    } });
    const css = await redirected.bundleCss('@import "https://example.test/start.css";', { type: 'local', path: path.join(dir, 'theme.css') });
    assert.equal(fetches, 1);
    assert.equal((css.match(/\.redirected/g) || []).length, 1);
    assert.ok(warnings.some(w => /cycle.*final.css.*final.css/.test(w)));
  });

  it('bounds concurrency and turns body failures/deadlines into recoverable warnings', async () => {
    let active = 0;
    let maximum = 0;
    const warnings = [];
    const loader = createResourceLoader({ warnings, concurrency: 2, fetchImpl: async () => {
      active++;
      maximum = Math.max(active, maximum);
      await delay(5);
      active--;
      return new Response('ok');
    } });
    await Promise.all(Array.from({ length: 10 }, (_, i) => loader.load({ type: 'remote', url: `https://example.test/${i}` })));
    assert.equal(maximum, 2);
    const bodyFailure = createResourceLoader({ warnings, fetchImpl: async () => ({
      ok: true, headers: new Headers(), arrayBuffer: async () => { throw new Error('broken body'); },
    }) });
    assert.equal(await bodyFailure.load({ type: 'remote', url: 'https://example.test/fail' }), null);
    let signal;
    const timeout = createResourceLoader({ warnings, timeoutMs: 10, fetchImpl: async (_, options) => {
      signal = options.signal;
      return new Promise(() => {});
    } });
    assert.equal(await timeout.load({ type: 'remote', url: 'https://example.test/hang' }), null);
    assert.equal(signal.aborted, true);
    assert.ok(warnings.some(w => /broken body/.test(w)));
    assert.ok(warnings.some(w => /deadline exceeded/.test(w)));
  });
});
