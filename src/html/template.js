import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tocScript = fs.readFileSync(path.join(__dirname, 'toc-script.js'), 'utf-8');
const imageWaitScript = fs.readFileSync(path.join(__dirname, 'image-wait-script.js'), 'utf-8');

export function buildHtmlDocument(pages, themeStylesheetHref, frontMatter, pageChromeCss) {
  const title = frontMatter.title || 'Untitled';
  const lang = frontMatter.lang || 'en';
  const author = frontMatter.author || '';
  const themeMarkup = renderThemeMarkup(themeStylesheetHref);
  const chromeMarkup = pageChromeCss ? `<style>\n${pageChromeCss}\n  </style>` : '';

  const pageHtml = pages.map((page, index) => {
    const layoutClass = page.layout === 'singlecol' ? 'singlecol' : 'twocol';
    const pageRole = page.pageRole || 'body';

    let pageClasses = `page ${layoutClass} ${pageRole}`;
    if (page.numbering === 'none') {
      pageClasses += ' page-number-hidden';
    }

    const headerHtml = page.headerText && page.headerVisible
      ? `<header class="running-header">${page.headerText}</header>`
      : '';

    const pageNumAttr = page.numbering === 'arabic' && page.pageNumber != null
      ? ` data-page-number="${page.pageNumber}"`
      : '';

    return `<div class="page-shell">
  <div class="${pageClasses}" id="p${index + 1}">
  ${headerHtml}
  <div class="page-content">
${page.html}
  </div>
  <div class="page-number"${pageNumAttr}></div>
</div>
</div>`;
  }).join('\n\n');

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="generator" content="MarkPublisher">
  ${title ? `<title>${escapeHtml(title)}</title>` : ''}
  ${author ? `<meta name="author" content="${escapeHtml(author)}">` : ''}
  ${themeMarkup}
  ${chromeMarkup}
</head>
<body>
<div id="pages-container">
<div id="pages-zoom-layer">
${pageHtml}
</div>
</div>
<script>
${tocScript}
</script>
<script>
${imageWaitScript}
</script>
</body>
</html>`;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderThemeMarkup(themeStylesheetHref) {
  if (!themeStylesheetHref) {
    return '';
  }

  const value = String(themeStylesheetHref);
  if (looksLikeStylesheetHref(value)) {
    return `<link rel="stylesheet" href="${value}">`;
  }

  return `<style>\n${value}\n  </style>`;
}

function looksLikeStylesheetHref(value) {
  return /\.css(?:$|[?#])/.test(value) || value.startsWith('assets/');
}
