import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { preprocess } from '../src/renderer/preprocessor.js';
import { transformPageContent } from '../src/renderer/index.js';
import { createAssetBundler } from '../src/html/assets.js';

function fixture(t, source) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'markpublisher-markdown-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'book.md');
  fs.writeFileSync(file, source);
  return { dir, result: preprocess(file, [], dir) };
}

describe('Markdown preservation', () => {
  it('keeps shorter fences and directives inside literal examples', t => {
    for (const marker of ['`', '~']) {
      const { result } = fixture(t, `${marker.repeat(4)}md\n${marker.repeat(3)}\n<!-- pagebreak -->\n![[missing]]\n${marker.repeat(4)}`);
      assert.equal(result.pages.length, 1);
      assert.deepEqual(result.warnings, []);
      const html = transformPageContent(result.pages[0].lines.join('\n'), result.pages[0]).html;
      assert.match(html, /&lt;!-- pagebreak --&gt;/);
      assert.ok(html.includes('![[missing]]'));
    }
  });

  it('preserves destination syntax, titles, inline code and escaped images', t => {
    const code = '`![Code](code.svg)` and \\![Escaped](escape.svg)';
    const { dir, result } = fixture(t, ['<!-- image: width: 50%; -->', '![Title](cover.svg "Cover title"){.cover}', '',
      '![Angle](<images/my cover.svg>)', '', '![Paren](images/cover(1).svg)', '', code].join('\n'));
    const source = result.pages[0].lines.join('\n');
    assert.ok(source.includes(code));
    const { html } = transformPageContent(source, result.pages[0]);
    assert.ok(html.includes(`src="${dir}/cover.svg"`));
    assert.match(html, /title="Cover title"/);
    assert.match(html, /style="width: 50%;"/);
    assert.match(html, /class="cover"/);
    assert.ok(html.includes('images/my%20cover.svg'));
    assert.ok(html.includes('images/cover(1).svg'));
    assert.ok(html.includes('<code>![Code](code.svg)</code>'));
  });

  it('preserves indented code and resolves root-first image URL suffixes', t => {
    const literal = '    <!-- pagebreak -->\n    ![Code](code.svg)';
    const { dir, result } = fixture(t, literal);
    assert.equal(result.pages.length, 1);
    assert.ok(result.pages[0].lines.join('\n').includes(literal));
    fs.mkdirSync(path.join(dir, 'chapters'));
    fs.mkdirSync(path.join(dir, 'images'));
    fs.writeFileSync(path.join(dir, 'images/icon.svg'), '<svg/>');
    fs.writeFileSync(path.join(dir, 'chapters/chapter.md'), '![Icon](images/icon.svg?v=1#shape)');
    fs.writeFileSync(path.join(dir, 'book.md'), '![[chapters/chapter]]');
    const included = preprocess(path.join(dir, 'book.md'), [], dir);
    assert.ok(included.pages[0].lines.join('\n').includes(`${dir}/images/icon.svg?v=1#shape`));
  });

  it('closes nested wrappers in reverse order at page breaks and EOF', t => {
    const { result } = fixture(t, '<!-- note -->\n\n<!-- tip -->\n\nInside\n\n<!-- pagebreak -->\n\n<!-- note -->\n\nLast');
    assert.deepEqual(result.pages[0].lines.slice(-2), ['<!-- /tip -->', '<!-- /note -->']);
    assert.ok(result.warnings.some(w => w.includes('auto-closes')));
    assert.ok(result.warnings.some(w => w.includes('unclosed')));
    for (const page of result.pages) {
      const html = transformPageContent(page.lines.join('\n'), page).html;
      assert.equal((html.match(/<div\b/g) || []).length, (html.match(/<\/div>/g) || []).length);
    }
  });

  it('keeps quoted/list code examples literal and closes wrappers after unfinished fences', t => {
    const source = [
      '> ````md', '> ```', '> ![Code](code.svg)', '> <!-- pagebreak -->', '> ````', '',
      '- ```md', '  ![List code](list.svg)', '  <!-- pagebreak -->', '  ```', '',
      '<!-- note -->', '', '```md', '![EOF code](eof.svg)',
    ].join('\n');
    const { result } = fixture(t, source);
    assert.equal(result.pages.length, 1);
    const content = result.pages[0].lines.join('\n');
    assert.equal(content, source);
    const { html } = transformPageContent(content, result.pages[0]);
    assert.ok(html.includes('![Code](code.svg)'));
    assert.ok(html.includes('![List code](list.svg)'));
    assert.ok(html.includes('![EOF code](eof.svg)'));
    assert.ok(html.endsWith('</div>\n'));
    assert.ok(result.warnings.some(w => w.includes('unclosed')));
  });

  it('bundles encoded filename characters without double-decoding them', async t => {
    const { dir } = fixture(t, '');
    const project = path.join(dir, 'book #100%');
    fs.mkdirSync(project);
    const image = path.join(project, 'icon%20#.svg');
    fs.writeFileSync(image, '<svg/>');
    const book = path.join(project, 'book.md');
    fs.writeFileSync(book, '![Encoded](icon%2520%23.svg)\n\n![[icon%20#.svg]]');
    const result = preprocess(book, [], project);
    const html = transformPageContent(result.pages[0].lines.join('\n'), result.pages[0]).html;
    const warnings = [];
    const outputDir = path.join(dir, 'output');
    const bundled = await createAssetBundler({ outputDir, warnings }).bundleHtml(html);
    assert.deepEqual(warnings, []);
    assert.equal((bundled.match(/src="assets\/icon%2520%23.svg"/g) || []).length, 2);
    assert.equal(fs.readFileSync(path.join(outputDir, 'assets/icon%20#.svg'), 'utf8'), '<svg/>');
  });

  it('uses the same block grammar for footnote images and nested code', t => {
    const { dir, result } = fixture(t, 'Text[^a]\n\n[^a]: Note.\n\n    ![In note](note.svg)\n\n    ```md\n    ![Code](unchanged.svg)\n    ```');
    const content = result.pages[0].lines.join('\n');
    assert.ok(content.includes(`${dir}/note.svg`));
    assert.ok(content.includes('![Code](unchanged.svg)'));
    const { html } = transformPageContent(content, result.pages[0]);
    assert.ok(html.includes(`src="${dir}/note.svg"`));
  });
});
