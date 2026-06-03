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

describe('html asset bundler', () => {
  it('copies local image assets into output/assets and rewrites src', async () => {
    cleanup();
    const sourceDir = path.join(TEST_DIR, 'source');
    const outputDir = path.join(TEST_DIR, 'output');
    fs.mkdirSync(sourceDir, { recursive: true });
    fs.mkdirSync(outputDir, { recursive: true });

    const sourceImage = path.join(sourceDir, 'cover.svg');
    fs.writeFileSync(sourceImage, '<svg/>');

    const warnings = [];
    const bundler = createAssetBundler({ outputDir, warnings });
    const html = await bundler.bundleHtml(`<p><img src="${sourceImage}" alt="Cover"></p>`);

    assert.ok(html.includes('src="assets/cover.svg"'));
    assert.ok(fs.existsSync(path.join(outputDir, 'assets', 'cover.svg')));
    assert.equal(warnings.length, 0);
    cleanup();
  });

  it('downloads remote image urls and rewrites them locally', async () => {
    cleanup();
    const outputDir = path.join(TEST_DIR, 'output');
    fs.mkdirSync(outputDir, { recursive: true });

    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
      res.end('<svg/>');
    });
    try {
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
      const { port } = server.address();

      const warnings = [];
      const bundler = createAssetBundler({ outputDir, warnings });
      const html = await bundler.bundleHtml(`<p><img src="http://127.0.0.1:${port}/image.svg" alt="Remote"></p>`);

      assert.ok(html.includes('src="assets/image.svg"'));
      assert.ok(fs.existsSync(path.join(outputDir, 'assets', 'image.svg')));
      assert.equal(warnings.length, 0);
    } finally {
      await new Promise(resolve => server.close(resolve));
      cleanup();
    }
  });

  it('avoids filename collisions for different local images with same basename', async () => {
    cleanup();
    const sourceDirA = path.join(TEST_DIR, 'a');
    const sourceDirB = path.join(TEST_DIR, 'b');
    const outputDir = path.join(TEST_DIR, 'output');
    fs.mkdirSync(sourceDirA, { recursive: true });
    fs.mkdirSync(sourceDirB, { recursive: true });
    fs.mkdirSync(outputDir, { recursive: true });

    const imageA = path.join(sourceDirA, 'cover.svg');
    const imageB = path.join(sourceDirB, 'cover.svg');
    fs.writeFileSync(imageA, '<svg>A</svg>');
    fs.writeFileSync(imageB, '<svg>B</svg>');

    const warnings = [];
    const bundler = createAssetBundler({ outputDir, warnings });
    const html = await bundler.bundleHtml(`<img src="${imageA}"><img src="${imageB}">`);

    const files = fs.readdirSync(path.join(outputDir, 'assets')).sort();
    assert.equal(files.length, 2);
    assert.ok(files[0] === 'cover.svg' || files[1] === 'cover.svg');
    assert.ok(files.some(file => /^cover-[a-f0-9]{8}\.svg$/.test(file)));
    assert.ok(html.includes('src="assets/cover.svg"'));
    assert.ok(/src="assets\/cover-[a-f0-9]{8}\.svg"/.test(html));
    cleanup();
  });

  it('reuses the same copied asset for repeated references', async () => {
    cleanup();
    const sourceDir = path.join(TEST_DIR, 'source');
    const outputDir = path.join(TEST_DIR, 'output');
    fs.mkdirSync(sourceDir, { recursive: true });
    fs.mkdirSync(outputDir, { recursive: true });

    const sourceImage = path.join(sourceDir, 'repeat.svg');
    fs.writeFileSync(sourceImage, '<svg/>');

    const warnings = [];
    const bundler = createAssetBundler({ outputDir, warnings });
    const html = await bundler.bundleHtml(`<img src="${sourceImage}"><img src="${sourceImage}">`);

    const files = fs.readdirSync(path.join(outputDir, 'assets'));
    assert.equal(files.length, 1);
    assert.equal((html.match(/assets\/repeat\.svg/g) || []).length, 2);
    cleanup();
  });

  it('warns and leaves missing local image paths unchanged', async () => {
    cleanup();
    const outputDir = path.join(TEST_DIR, 'output');
    fs.mkdirSync(outputDir, { recursive: true });
    const missingImage = path.join(TEST_DIR, 'missing.svg');

    const warnings = [];
    const bundler = createAssetBundler({ outputDir, warnings });
    const html = await bundler.bundleHtml(`<img src="${missingImage}" alt="Missing">`);

    assert.ok(html.includes(`src="${missingImage}"`));
    assert.ok(warnings.some(w => w.includes('Missing asset')));
    cleanup();
  });

  it('bundles local css url assets and writes bundled css', async () => {
    cleanup();
    const themeDir = path.join(TEST_DIR, 'theme');
    const outputDir = path.join(TEST_DIR, 'output');
    fs.mkdirSync(path.join(themeDir, 'images'), { recursive: true });
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(path.join(themeDir, 'images', 'bg.svg'), '<svg/>');

    const warnings = [];
    const bundler = createAssetBundler({ outputDir, warnings });
    const css = await bundler.bundleCss('.hero { background-image: url("images/bg.svg"); }', {
      type: 'local',
      path: path.join(themeDir, 'styles.css'),
    });
    const href = bundler.writeBundledCss(css);

    assert.equal(href, 'assets/theme.css');
    assert.ok(fs.existsSync(path.join(outputDir, 'assets', 'bg.svg')));
    const writtenCss = fs.readFileSync(path.join(outputDir, 'assets', 'theme.css'), 'utf-8');
    assert.ok(writtenCss.includes('url("bg.svg")'));
    assert.equal(warnings.length, 0);
    cleanup();
  });

  it('bundles remote css imports and referenced assets', async () => {
    cleanup();
    const outputDir = path.join(TEST_DIR, 'output');
    fs.mkdirSync(outputDir, { recursive: true });

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
      const bundler = createAssetBundler({ outputDir, warnings });
      const css = await bundler.bundleCss(`@import "http://127.0.0.1:${port}/import.css";`, {
        type: 'local',
        path: path.join(TEST_DIR, 'styles.css'),
      });

      assert.ok(css.includes('font.woff2'));
      assert.ok(css.includes('remote.svg'));
      assert.ok(fs.existsSync(path.join(outputDir, 'assets', 'font.woff2')));
      assert.ok(fs.existsSync(path.join(outputDir, 'assets', 'remote.svg')));
      assert.equal(warnings.length, 0);
    } finally {
      await new Promise(resolve => server.close(resolve));
      cleanup();
    }
  });
});
