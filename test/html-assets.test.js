import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createAssetBundler } from '../src/html/assets.js';

const TEST_DIR = path.join(import.meta.dirname || '.', 'assets-fixtures');

function cleanup() {
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  }
}

const b64 = value => Buffer.from(value).toString('base64');

describe('html asset bundler (self-contained)', () => {
  it('inlines local image assets as data URIs', async () => {
    cleanup();
    const sourceDir = path.join(TEST_DIR, 'source');
    fs.mkdirSync(sourceDir, { recursive: true });

    const sourceImage = path.join(sourceDir, 'cover.svg');
    fs.writeFileSync(sourceImage, '<svg/>');

    const warnings = [];
    const bundler = createAssetBundler({ warnings });
    const html = await bundler.bundleHtml(`<p><img src="${sourceImage}" alt="Cover"></p>`);

    assert.ok(html.includes(`src="data:image/svg+xml;base64,${b64('<svg/>')}"`));
    assert.ok(!html.includes('assets/'));
    assert.equal(warnings.length, 0);
    cleanup();
  });

  it('downloads remote image urls and inlines them as data URIs', async () => {
    cleanup();
    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
      res.end('<svg/>');
    });
    try {
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
      const { port } = server.address();

      const warnings = [];
      const bundler = createAssetBundler({ warnings });
      const html = await bundler.bundleHtml(`<p><img src="http://127.0.0.1:${port}/image.svg" alt="Remote"></p>`);

      assert.ok(html.includes('src="data:image/svg+xml;base64,'));
      assert.ok(!html.includes('assets/'));
      assert.equal(warnings.length, 0);
    } finally {
      await new Promise(resolve => server.close(resolve));
      cleanup();
    }
  });

  it('inlines distinct images with the same basename as distinct data URIs', async () => {
    cleanup();
    const sourceDirA = path.join(TEST_DIR, 'a');
    const sourceDirB = path.join(TEST_DIR, 'b');
    fs.mkdirSync(sourceDirA, { recursive: true });
    fs.mkdirSync(sourceDirB, { recursive: true });

    const imageA = path.join(sourceDirA, 'cover.svg');
    const imageB = path.join(sourceDirB, 'cover.svg');
    fs.writeFileSync(imageA, '<svg>A</svg>');
    fs.writeFileSync(imageB, '<svg>B</svg>');

    const warnings = [];
    const bundler = createAssetBundler({ warnings });
    const html = await bundler.bundleHtml(`<img src="${imageA}"><img src="${imageB}">`);

    assert.ok(html.includes(b64('<svg>A</svg>')));
    assert.ok(html.includes(b64('<svg>B</svg>')));
    assert.ok(!html.includes('assets/'));
    cleanup();
  });

  it('reuses the same data URI for repeated references', async () => {
    cleanup();
    const sourceDir = path.join(TEST_DIR, 'source');
    fs.mkdirSync(sourceDir, { recursive: true });

    const sourceImage = path.join(sourceDir, 'repeat.svg');
    fs.writeFileSync(sourceImage, '<svg/>');

    const warnings = [];
    const bundler = createAssetBundler({ warnings });
    const html = await bundler.bundleHtml(`<img src="${sourceImage}"><img src="${sourceImage}">`);

    const matches = html.match(/data:image\/svg\+xml;base64,[A-Za-z0-9+/=]+/g) || [];
    assert.equal(matches.length, 2);
    assert.equal(matches[0], matches[1]);
    assert.equal(Buffer.from(matches[0].split(',')[1], 'base64').toString('utf8'), '<svg/>');
    cleanup();
  });

  it('warns and leaves missing local image paths unchanged', async () => {
    cleanup();
    const missingImage = path.join(TEST_DIR, 'missing.svg');

    const warnings = [];
    const bundler = createAssetBundler({ warnings });
    const html = await bundler.bundleHtml(`<img src="${missingImage}" alt="Missing">`);

    assert.ok(html.includes(`src="${missingImage}"`));
    assert.ok(warnings.some(w => w.includes('Missing asset')));
    cleanup();
  });

  it('inlines local css url assets as data URIs', async () => {
    cleanup();
    const themeDir = path.join(TEST_DIR, 'theme');
    fs.mkdirSync(path.join(themeDir, 'images'), { recursive: true });
    fs.writeFileSync(path.join(themeDir, 'images', 'bg.svg'), '<svg/>');

    const warnings = [];
    const bundler = createAssetBundler({ warnings });
    const css = await bundler.bundleCss('.hero { background-image: url("images/bg.svg"); }', {
      type: 'local',
      path: path.join(themeDir, 'styles.css'),
    });

    assert.ok(css.includes(`url("data:image/svg+xml;base64,${b64('<svg/>')}")`));
    assert.ok(!css.includes('assets/'));
    assert.equal(warnings.length, 0);
    cleanup();
  });

  it('inlines remote css imports and referenced assets', async () => {
    cleanup();
    const server = http.createServer((req, res) => {
      if (req.url === '/import.css') {
        res.writeHead(200, { 'Content-Type': 'text/css' });
        res.end('@font-face { src: url("/font.woff2"); } .imported { background-image: url("/remote.svg"); }');
        return;
      }

      if (req.url === '/font.woff2') {
        res.writeHead(200, { 'Content-Type': 'font/woff2' });
        res.end('fontdata');
        return;
      }

      if (req.url === '/remote.svg') {
        res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
        res.end('<svg/>');
        return;
      }

      res.writeHead(404);
      res.end();
    });
    try {
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
      const { port } = server.address();

      const warnings = [];
      const bundler = createAssetBundler({ warnings });
      const css = await bundler.bundleCss(`@import "http://127.0.0.1:${port}/import.css";`, {
        type: 'local',
        path: path.join(TEST_DIR, 'styles.css'),
      });

      assert.ok(css.includes('data:font/woff2;base64,'));
      assert.ok(css.includes('data:image/svg+xml;base64,'));
      assert.ok(!css.includes('assets/'));
      assert.equal(warnings.length, 0);
    } finally {
      await new Promise(resolve => server.close(resolve));
      cleanup();
    }
  });
});
