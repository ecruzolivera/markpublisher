import { it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import puppeteer from 'puppeteer';
import { PDFDocument } from 'pdf-lib';
import { startPreviewServer } from '../src/commands/serve.js';

it('builds the canonical sample through the CLI and previews live edits', { timeout: 45000 }, async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'markpublisher-sample-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const source = path.resolve(import.meta.dirname, '../samples/sample-book');
  fs.cpSync(source, dir, { recursive: true, filter: file => path.relative(source, file) !== 'output' });
  // Only the remote import URL in the temporary copy changes. Use a local HTTP
  // stylesheet fixture to exercise downloads/warnings without Google uptime.
  const fonts = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/css' });
    res.end('/* offline font fixture: deterministic system fallback */');
  });
  await new Promise(resolve => fonts.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    const stopped = new Promise(resolve => fonts.close(resolve));
    fonts.closeAllConnections();
    await stopped;
  });
  const themePath = path.join(dir, 'themes/default/theme.css');
  fs.writeFileSync(themePath, fs.readFileSync(themePath, 'utf8').replace(/https:\/\/fonts.googleapis.com\/[^"\n]+/, `http://127.0.0.1:${fonts.address().port}/fonts.css`));
  const cli = path.resolve(import.meta.dirname, '../src/cli.js');
  const command = await promisify(execFile)(process.execPath, [cli, 'build'], { cwd: dir, timeout: 35000 });
  assert.match(command.stdout, /Done\./);
  assert.match(command.stderr, /Remote font detected/);
  const htmlPath = path.join(dir, 'output/my sample book.html');
  const pdfPath = path.join(dir, 'output/my sample book.pdf');
  const pdf = await PDFDocument.load(fs.readFileSync(pdfPath));
  assert.ok(pdf.getPageCount() > 10);
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.goto(pathToFileURL(htmlPath).href);
  await page.evaluate(() => window.__tocReady);
  const outcome = await page.evaluate(() => {
    const ids = [...document.querySelectorAll('[id]')].map(el => el.id);
    return {
      unique: ids.length === new Set(ids).size,
      duplicates: [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))].map(id => ({
        id, elements: [...document.querySelectorAll('[id]')].filter(el => el.id === id).map(el => el.outerHTML.slice(0, 250)),
      })),
      pages: document.querySelectorAll('.page-shell:not(.spacer)').length,
      links: [...document.querySelectorAll('.toc-link')].every(link => !!document.getElementById(decodeURIComponent(link.hash.slice(1)))),
      brokenLinks: [...document.querySelectorAll('.toc-link')].filter(link => !document.getElementById(decodeURIComponent(link.hash.slice(1)))).map(link => link.getAttribute('href')),
      entries: document.querySelectorAll('.toc-link').length,
      firstNumber: document.querySelector('.page-number[data-page-number]')?.dataset.pageNumber,
    };
  });
  assert.equal(outcome.unique, true, JSON.stringify(outcome.duplicates));
  assert.ok(outcome.pages > 10);
  assert.ok(outcome.entries > 0);
  assert.equal(outcome.links, true, JSON.stringify(outcome.brokenLinks));
  assert.equal(outcome.firstNumber, '1');
  await page.click('#tb-spread-single');
  assert.equal(await page.evaluate(() => document.querySelector('#pages-zoom-layer').classList.contains('spread-single')), true);
  await page.evaluate(() => {
    const slider = document.querySelector('#tb-zoom-slider');
    slider.value = '150';
    slider.dispatchEvent(new Event('input'));
  });
  assert.equal(await page.evaluate(() => document.querySelector('.page').style.transform), 'scale(1.5)');
  const preview = await startPreviewServer({ cwd: dir, portOverride: 0 });
  t.after(() => preview.close());
  assert.match(await fetch(preview.url).then(r => r.text()), /MarkPublisher Tutorial/);
  fs.appendFileSync(path.join(dir, 'book.md'), '\n\n# Sample Live Revision\n');
  let revised = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if ((await fetch(preview.url).then(r => r.text())).includes('Sample Live Revision</h1>')) { revised = true; break; }
    await delay(25);
  }
  assert.equal(revised, true);
});
