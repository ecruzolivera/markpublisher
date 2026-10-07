import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import puppeteer from 'puppeteer';
import { startPreviewServer } from '../src/commands/serve.js';

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'markpublisher-serve-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, 'themes/default'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'themes/default/theme.css'), '.page { height:297mm; width:210mm; background:white }');
  fs.writeFileSync(path.join(dir, 'book.md'), '# Original');
  return dir;
}

async function eventually(read, predicate, timeout = 7000) {
  const deadline = Date.now() + timeout;
  let value;
  while (Date.now() < deadline) {
    value = await read();
    if (predicate(value)) return value;
    await delay(25);
  }
  assert.fail(`Expected preview update; last response: ${String(value).slice(0, 300)}`);
}

async function start(t, dir) {
  const server = await startPreviewServer({ cwd: dir, portOverride: 0 });
  t.after(() => server.close());
  return server;
}

describe('live preview', () => {
  it('starts without config, applies new config and recovers from invalid edits', async t => {
    const dir = fixture(t);
    const server = await start(t, dir);
    assert.ok(server.url.startsWith('http://127.0.0.1:'));
    const read = () => fetch(server.url).then(response => response.text());
    assert.match(await read(), /Original<\/h1>/);
    const controller = new AbortController();
    const live = await fetch(`${server.url}/live`, { signal: controller.signal });
    const reader = live.body.getReader();
    t.after(async () => { controller.abort(); await reader.cancel().catch(() => {}); });
    assert.match(new TextDecoder().decode((await reader.read()).value), /event: hello/);
    fs.writeFileSync(path.join(dir, 'new.md'), '# Updated');
    const config = path.join(dir, 'markpublisher.toml');
    fs.writeFileSync(config, 'input = "new.md"');
    await eventually(read, html => html.includes('Updated</h1>'));
    assert.match(new TextDecoder().decode((await reader.read()).value), /data: reload/);
    fs.writeFileSync(config, 'input = [');
    await eventually(read, html => html.includes('Preview error') && html.includes('Invalid TOML'));
    fs.writeFileSync(config, 'input = "missing.md"');
    await eventually(read, html => html.includes('Input file not found'));
    fs.writeFileSync(path.join(dir, 'missing.md'), '# Recovered');
    await eventually(read, html => html.includes('Recovered</h1>'));
    fs.writeFileSync(config, 'input = "missing.md"\n[serve]\nport = 4001');
    await eventually(async () => { await read(); return server.warnings.join('\n'); }, warnings => warnings.includes('restart the server'));
    await server.close();
    await server.close();
  });

  it('finds parent config, reloads themes and serves only registered assets', async t => {
    const dir = fixture(t);
    const chapters = path.join(dir, 'chapters');
    fs.mkdirSync(chapters);
    fs.writeFileSync(path.join(dir, 'markpublisher.toml'), 'input = "book.md"');
    fs.writeFileSync(path.join(dir, 'secret.txt'), 'not a preview asset');
    fs.mkdirSync(path.join(dir, 'themes/other'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'themes/other/theme.css'), '@import "nested.css"; .page { width:210mm; height:297mm }');
    fs.writeFileSync(path.join(dir, 'themes/other/nested.css'), '.page { background-image:url("background.svg"); color:rgb(10, 20, 30) }');
    fs.writeFileSync(path.join(dir, 'themes/other/background.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
    const server = await start(t, chapters);
    fs.writeFileSync(path.join(dir, 'markpublisher.toml'), 'theme = "other"');
    const css = await eventually(() => fetch(`${server.url}/theme.css`).then(r => r.text()), css => css.includes('background-image'));
    const background = css.match(/url\("([^\"]+)"\)/)[1];
    assert.equal((await fetch(server.url + background)).status, 200);
    for (const url of ['/files/markpublisher.toml', '/files/secret.txt', '/assets/unknown/secret.txt', '/assets/unknown/%2e%2e%2fsecret.txt']) {
      assert.equal((await fetch(server.url + url)).status, 404);
    }
    fs.writeFileSync(path.join(dir, 'themes/other/nested.css'), '.page { color:rgb(40, 50, 60) }');
    await eventually(() => fetch(`${server.url}/theme.css`).then(r => r.text()), css => css.includes('40, 50, 60'));
    assert.equal((await fetch(server.url + background)).status, 404);
  });

  it('loads local fonts, images, and imported stylesheet URLs in the browser', async t => {
    const dir = fixture(t);
    const theme = path.join(dir, 'themes/default');
    fs.writeFileSync(path.join(theme, 'background.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>');
    // Puppeteer ships test-independent system fonts on the supported Linux CI runner.
    const systemFont = [
      '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
      '/usr/share/fonts/liberation/LiberationSans-Regular.ttf',
      '/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf',
    ].find(file => fs.existsSync(file));
    if (!systemFont) return t.skip('Test system font unavailable');
    fs.copyFileSync(systemFont, path.join(theme, 'book.ttf'));
    fs.writeFileSync(path.join(theme, 'nested.css'), '@font-face { font-family: PreviewBook; src:url("book.ttf") } .page { font-family:PreviewBook; background-image:url("background.svg") }');
    fs.appendFileSync(path.join(theme, 'theme.css'), '\n@import "nested.css";');
    fs.writeFileSync(path.join(dir, 'book.md'), '# Font preview\n\n<img src=\'themes/default/background.svg\' alt="Image">');
    const server = await start(t, dir);
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    t.after(() => browser.close());
    const page = await browser.newPage();
    const failures = [];
    page.on('requestfailed', request => failures.push(request.url()));
    await page.goto(server.url, { waitUntil: 'load' });
    const outcome = await page.evaluate(async () => {
      await document.fonts.ready;
      return {
        font: [...document.fonts].find(font => font.family === 'PreviewBook')?.status,
        image: document.querySelector('img').naturalWidth,
        background: getComputedStyle(document.querySelector('.page')).backgroundImage,
        toolbar: !!document.querySelector('#pagination-toolbar'),
      };
    });
    assert.equal(outcome.font, 'loaded');
    assert.ok(outcome.image > 0);
    assert.match(outcome.background, /\/assets\//);
    assert.equal(outcome.toolbar, true);
    assert.deepEqual(failures, []);
  });

  it('recovers when an invalid newly selected global theme is corrected', async t => {
    const dir = fixture(t);
    const previousHome = process.env.HOME;
    process.env.HOME = path.join(dir, 'home');
    t.after(() => {
      if (previousHome === undefined) delete process.env.HOME;
      else process.env.HOME = previousHome;
    });
    const global = path.join(process.env.HOME, '.config/markpublisher/themes/global-only');
    fs.mkdirSync(global, { recursive: true });
    const css = path.join(global, 'theme.css');
    fs.writeFileSync(css, 'body {');
    const server = await start(t, dir);
    const read = () => fetch(server.url).then(response => response.text());
    fs.writeFileSync(path.join(dir, 'markpublisher.toml'), 'theme = "global-only"');
    await eventually(read, html => html.includes('Preview error') && html.includes('Unclosed block'));
    fs.writeFileSync(css, '.page { width:6in; height:9in } body { color:rgb(12,34,56) }');
    await eventually(read, html => !html.includes('Preview error') && html.includes('Original</h1>'));
    assert.ok((await fetch(`${server.url}/theme.css`).then(response => response.text())).includes('rgb(12,34,56)'));
  });
});
