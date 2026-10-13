import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { loadConfig } from '../config.js';
import { discoverTheme, parseThemeCss } from '../themes/loader.js';
import { preprocess } from '../renderer/preprocessor.js';
import { renderDocument } from '../renderer/document.js';
import { buildHtmlDocument } from '../html/template.js';
import { createAssetBundler } from '../html/assets.js';
import { generatePageChrome } from '../html/page-chrome.js';
import { addPreviewControls } from '../html/preview.js';
import { hasFontFaces, detectUsedFontFaces, trimUnusedFontFaces } from '../html/fonts.js';
import { generatePdf } from '../pdf/generator.js';

export async function buildCommand({ cwd = process.cwd(), pdfGenerator = generatePdf, fetchImpl = globalThis.fetch, fontDetector = detectUsedFontFaces } = {}) {
  const { config, warnings: configWarnings } = loadConfig(cwd);
  const warnAll = [...configWarnings];

  const inputPath = config.input || 'book.md';
  const absInput = path.resolve(config._configDir || process.cwd(), inputPath);

  if (!fs.existsSync(absInput)) {
    throw Object.assign(new Error(`Input file not found: ${absInput}`), { exitCode: 1 });
  }

  console.log(`Loading ${absInput}...`);

  const result = preprocess(absInput, warnAll, config._configDir);

  if (!result.success) {
    throw new Error(`Preprocessing errors:\n${result.errors.join('\n')}`);
  }

  const themeResult = discoverTheme(config.theme || 'default', warnAll, config._configDir);

  const outputDir = path.resolve(config._configDir || process.cwd(), config.outputDir || './output');
  fs.mkdirSync(outputDir, { recursive: true });
  const htmlPath = path.join(outputDir, (config.name || 'output') + '.html');
  const shouldWriteHtml = config.output?.html !== false;
  const assetBundler = createAssetBundler({ warnings: warnAll, fetchImpl });
  const bundledThemeParts = [];
  for (const cssEntry of themeResult.cssEntries || []) {
    bundledThemeParts.push(await assetBundler.bundleCss(cssEntry.content, { type: 'local', path: cssEntry.path }));
  }
  const bundledCss = bundledThemeParts.join('\n');
  const pdfSize = parseThemeCss(bundledCss, warnAll);

  const pages = await renderDocument(result, html => assetBundler.bundleHtml(html), warnAll);

  const fullHtml = buildHtmlDocument(pages, bundledCss, result.frontMatter, generatePageChrome());

  let htmlWithToolbar = addPreviewControls(fullHtml);

  if (config.build.trimUnusedFonts !== false && hasFontFaces(bundledCss)) {
    const probePath = path.join(outputDir, `.markpublisher-${crypto.randomUUID()}.html`);
    try {
      fs.writeFileSync(probePath, htmlWithToolbar);
      const { screen, print } = await fontDetector(probePath);
      const trimmed = trimUnusedFontFaces(bundledCss, screen, print);
      if (trimmed.removed > 0) {
        htmlWithToolbar = addPreviewControls(buildHtmlDocument(pages, trimmed.css, result.frontMatter, generatePageChrome()));
        console.log(`Embedded fonts trimmed to those in use (removed ${trimmed.removed}).`);
      }
    } catch (error) {
      warnAll.push(`Font trimming skipped (${error.message}); all declared fonts will be embedded.`);
    } finally {
      fs.rmSync(probePath, { force: true });
    }
  }

  if (warnAll.length) {
    console.warn(`\nWarnings (${warnAll.length}):`);
    warnAll.forEach(w => console.warn(`  ${w}`));
  }
  if (config.build.failOnWarning && warnAll.length) {
    throw new Error(`Build failed: ${warnAll.length} warning(s) and failOnWarning is enabled.`);
  }

  if (shouldWriteHtml) {
    fs.writeFileSync(htmlPath, htmlWithToolbar);
    console.log(`HTML → ${htmlPath}`);
  }

  let pdfPath = null;
  if (config.output?.pdf !== false) {
    console.log('Generating PDF...');
    pdfPath = path.join(outputDir, (config.name || 'output') + '.pdf');
    let temporaryPath;
    try {
      let pdfInput = htmlPath;
      if (!shouldWriteHtml) {
        const candidate = path.join(outputDir, `.markpublisher-${crypto.randomUUID()}.html`);
        const descriptor = fs.openSync(candidate, 'wx');
        temporaryPath = candidate;
        try { fs.writeFileSync(descriptor, htmlWithToolbar); } finally { fs.closeSync(descriptor); }
        pdfInput = temporaryPath;
      }
      await pdfGenerator(pdfInput, pdfSize, pdfPath);
    } finally {
      if (temporaryPath) fs.rmSync(temporaryPath, { force: true });
    }
    console.log(`PDF → ${pdfPath}`);
  }

  console.log('Done.');
  return { outputDir, htmlPath: shouldWriteHtml ? htmlPath : null, pdfPath, warnings: warnAll, pages };
}
