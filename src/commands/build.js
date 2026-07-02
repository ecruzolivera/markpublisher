import path from 'node:path';
import fs from 'node:fs';
import { loadConfig } from '../config.js';
import { discoverTheme } from '../themes/loader.js';
import { preprocess } from '../renderer/preprocessor.js';
import { transformPageContent, extractHeadingContext } from '../renderer/index.js';
import { buildHtmlDocument } from '../html/template.js';
import { createAssetBundler } from '../html/assets.js';
import { generatePageChrome } from '../html/page-chrome.js';
import { generatePaginationToolbar } from '../html/pagination-toolbar.js';
import { generatePdf } from '../pdf/generator.js';

export async function buildCommand() {
  const { config, warnings: configWarnings } = loadConfig();
  const warnAll = [...configWarnings];

  const inputPath = config.input || 'book.md';
  const absInput = path.resolve(config._configDir || process.cwd(), inputPath);

  if (!fs.existsSync(absInput)) {
    console.error(`Input file not found: ${absInput}`);
    process.exit(1);
  }

  console.log(`Loading ${absInput}...`);

  const result = preprocess(absInput, warnAll, config._configDir);

  if (!result.success) {
    console.error('Preprocessing errors:');
    result.errors.forEach(e => console.error(`  ${e}`));
    process.exit(3);
  }

  const themeResult = discoverTheme(config.theme || 'default', warnAll, config._configDir);

  const outputDir = path.resolve(config._configDir || process.cwd(), config.outputDir || './output');
  fs.mkdirSync(outputDir, { recursive: true });
  const htmlPath = path.join(outputDir, (config.name || 'output') + '.html');
  const shouldWriteHtml = config.output?.html !== false;
  const assetBundler = createAssetBundler({ outputDir, warnings: warnAll });
  const bundledThemeParts = [];
  for (const cssEntry of themeResult.cssEntries || []) {
    bundledThemeParts.push(await assetBundler.bundleCss(cssEntry.content, { type: 'local', path: cssEntry.path }));
  }
  const bundledThemeHref = assetBundler.writeBundledCss(bundledThemeParts.join('\n'));

  const pages = [];
  let headingContext = null;

  for (let i = 0; i < result.pages.length; i++) {
    const pageMeta = result.pages[i];
    const content = pageMeta.lines.join('\n');

    if (content.trim() === '') {
      const isToc = pageMeta.tocPages > 0;
      pages.push({
        html: '',
        layout: pageMeta.layout,
        pageRole: isToc ? 'toc' : 'body',
        headerText: null,
        headerVisible: pageMeta.headerVisible,
        numbering: pageMeta.numbering,
        pageNumber: null,
      });
      continue;
    }

    const { html, warnings } = transformPageContent(content, pageMeta);
    warnAll.push(...warnings);
    const rewrittenHtml = await assetBundler.bundleHtml(html);

    const heading = extractHeadingContext(content);
    if (heading) headingContext = heading;

    const isToc = pageMeta.tocPages > 0;

    let pageNumber = null;
    if (pageMeta.numbering === 'arabic') {
      pageNumber = pageMeta.numberStart + pageMeta.numberCounter;
    }

    pages.push({
      html: rewrittenHtml,
      layout: pageMeta.layout,
      pageRole: isToc ? 'toc' : 'body',
      headerText: headingContext,
      headerVisible: pageMeta.headerVisible,
      numbering: pageMeta.numbering,
      pageNumber,
    });
  }

  const fullHtml = buildHtmlDocument(pages, bundledThemeHref, result.frontMatter, generatePageChrome());

  const toolbarPadding = `<style>@media screen { html { scroll-padding-top: calc(var(--toolbar-height) + 40px); } #pages-container { padding-top: calc(var(--toolbar-height) + 40px); } }</style>`;
  const htmlWithToolbar = fullHtml
    .replace('</head>', toolbarPadding + '</head>')
    .replace('</body>', generatePaginationToolbar() + '</body>');

  if (shouldWriteHtml) {
    fs.writeFileSync(htmlPath, htmlWithToolbar);
    console.log(`HTML → ${htmlPath}`);
  }

  if (config.output?.pdf !== false) {
    console.log('Generating PDF...');
    const pdfPath = path.join(outputDir, (config.name || 'output') + '.pdf');
    try {
      if (!shouldWriteHtml) {
        fs.writeFileSync(htmlPath, htmlWithToolbar);
      }
      await generatePdf(htmlPath, themeResult.pdfSize, pdfPath);
    } finally {
      if (!shouldWriteHtml && fs.existsSync(htmlPath)) {
        fs.unlinkSync(htmlPath);
      }
    }
    console.log(`PDF → ${pdfPath}`);
  }

  if (warnAll.length) {
    console.warn(`\nWarnings (${warnAll.length}):`);
    warnAll.forEach(w => console.warn(`  ${w}`));
  }

  const failOnWarning = config.build?.failOnWarning === true;
  if (failOnWarning && warnAll.length) {
    console.error(`\nBuild failed: ${warnAll.length} warning(s) and failOnWarning is enabled.`);
    process.exit(3);
  }

  console.log('Done.');
}
