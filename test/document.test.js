import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import puppeteer from 'puppeteer';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { preprocess } from '../src/renderer/preprocessor.js';
import { renderDocument } from '../src/renderer/document.js';
import { buildHtmlDocument } from '../src/html/template.js';
import { generatePageChrome } from '../src/html/page-chrome.js';

function fixture(t, source) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'markpublisher-document-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const book = path.join(dir, 'book.md');
  fs.writeFileSync(book, source);
  return { dir, result: preprocess(book) };
}

describe('document navigation', () => {
  it('reserves future explicit IDs and isolates repeated renders', async t => {
    const { result } = fixture(t, '# Summary\n<!-- pagebreak -->\n# Summary\n<!-- pagebreak -->\n<!-- apply-next:#summary -->\n# Explicit\n<!-- pagebreak -->\n# tb-prev');
    const first = await renderDocument(result);
    assert.match(first[0].html, /id="summary-1"/);
    assert.match(first[1].html, /id="summary-2"/);
    assert.match(first[2].html, /id="summary"/);
    assert.match(first[3].html, /id="tb-prev-1"/);
    assert.deepEqual(await renderDocument(result), first);
  });

  it('diagnoses conflicting explicit IDs without renaming them', async t => {
    const { result } = fixture(t, '# One {#same}\n# Two {#same}\n<!-- pagebreak -->\n# Three {#same}\n# Page {#p1}');
    const warnings = [];
    const pages = await renderDocument(result, undefined, warnings);
    assert.equal((pages.map(p => p.html).join('').match(/id="same"/g) || []).length, 3);
    assert.ok(warnings.some(w => /same.*page 1.*page 2.*ambiguous/.test(w)));
    assert.ok(warnings.some(w => /p1.*renderer page chrome/.test(w)));
  });

  it('rejects explicit-ID ambiguity in strict CLI builds', t => {
    const { dir } = fixture(t, '# One {#same}\n<!-- pagebreak -->\n# Two {#same}');
    fs.mkdirSync(path.join(dir, 'themes/default'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'themes/default/theme.css'), '@page { size: A4 }');
    fs.writeFileSync(path.join(dir, 'markpublisher.toml'), '[output]\npdf = false\n[build]\nfailOnWarning = true');
    const command = spawnSync(process.execPath, [path.resolve(import.meta.dirname, '../src/cli.js'), 'build'], { cwd: dir, encoding: 'utf8' });
    assert.equal(command.status, 3);
    assert.match(command.stderr, /Duplicate explicit ID "same".*page 1.*page 2.*ambiguous/);
  });

  it('keeps TOC, footnote links and page shells correct in the browser', async t => {
    const { dir, result } = fixture(t, '<!-- toc:pages=1 -->\n<!-- page-number:start=1 -->\n# Summary: café\n\nText[^a] again[^a]\n\n[^a]: First\n\n<!-- note -->\n\n<!-- tip -->\n\nInside\n\n<!-- pagebreak -->\n# Summary: café\n\nText[^b]\n\n[^b]: Second\n\n<h2>HTML heading</h2>');
    const pages = await renderDocument(result);
    const css = '.page { width: 600px; height: 800px; padding: 20px; box-sizing: border-box; } .toc-list { margin: 0; padding: 0; list-style: none; }';
    const htmlPath = path.join(dir, 'book.html');
    fs.writeFileSync(htmlPath, buildHtmlDocument(pages, css, {}, generatePageChrome()));
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    t.after(() => browser.close());
    const page = await browser.newPage();
    await page.goto(pathToFileURL(htmlPath).href);
    await page.evaluate(() => window.__tocReady);
    const outcome = await page.evaluate(() => ({
      ids: [...document.querySelectorAll('[id]')].map(el => el.id),
      toc: [...document.querySelectorAll('.toc-link')].map(link => document.getElementById(decodeURIComponent(link.hash.slice(1))).closest('.page').id),
      notes: [...document.querySelectorAll('.footnote-ref a, .footnote-backref')].every(link =>
        document.getElementById(link.hash.slice(1)).closest('.page') === link.closest('.page')),
      shells: [...document.querySelectorAll('.page-shell')].every(shell => shell.parentElement.id === 'pages-zoom-layer'),
    }));
    assert.equal(new Set(outcome.ids).size, outcome.ids.length);
    assert.deepEqual(outcome.toc, ['p2', 'p3', 'p3']);
    assert.equal(outcome.notes, true);
    assert.equal(outcome.shells, true);
  });
});
