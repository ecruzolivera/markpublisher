import { renderMarkdown } from './markdown.js';

function isFenceBoundary(line, fence) {
  const trimmed = line.trim();
  if (fence.inFence) {
    if (fence.marker === '`' && /^`{3,}\s*$/.test(trimmed)) {
      fence.inFence = false;
      return true;
    }
    if (fence.marker === '~' && /^~{3,}\s*$/.test(trimmed)) {
      fence.inFence = false;
      return true;
    }
    return false;
  }
  const backtickMatch = trimmed.match(/^(`{3,})/);
  if (backtickMatch) {
    fence.inFence = true;
    fence.marker = '`';
    return true;
  }
  const tildeMatch = trimmed.match(/^(~{3,})/);
  if (tildeMatch) {
    fence.inFence = true;
    fence.marker = '~';
    return true;
  }
  return false;
}

export function transformDirectives(pageContent, state) {
  const lines = pageContent.split('\n');
  const result = [];
  let tocExcludeDepth = 0;
  const fence = { inFence: false, marker: '' };

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    if (isFenceBoundary(lines[i], fence)) {
      result.push(lines[i]);
      continue;
    }

    if (fence.inFence) {
      result.push(lines[i]);
      continue;
    }

    if (trimmed === '<!-- columnbreak -->') {
      result.push('<div class="column-break"></div>');
      continue;
    }

    const tocMatch = trimmed.match(/^<!--\s*toc\s*:\s*page\s*=\s*(\d+)\s+of\s*=\s*(\d+)(?:\s+levels\s*=\s*(.+?))?\s*-->/);
    if (tocMatch) {
      const levelsAttr = tocMatch[3] ? ` data-toc-levels="${tocMatch[3].replace(/\s+/g, '')}"` : '';
      result.push(`<nav class="toc-placeholder"${levelsAttr}></nav>`);
      continue;
    }

    if (trimmed === '<!-- toc-exclude -->') {
      result.push('<!-- TOC_EXCLUDE_START -->');
      tocExcludeDepth++;
      continue;
    }

    if (trimmed === '<!-- /toc-exclude -->') {
      result.push('<!-- TOC_EXCLUDE_END -->');
      tocExcludeDepth = Math.max(0, tocExcludeDepth - 1);
      continue;
    }

    const imageMatch = trimmed.match(/^<!--\s*image\s*:\s*(.+?)\s*-->$/);
    if (imageMatch) {
      state.pendingImageCss = imageMatch[1].trim();
      continue;
    }

    const tableMatch = trimmed.match(/^<!--\s*table\s*:\s*(.+?)\s*-->$/);
    if (tableMatch) {
      state.pendingTableWidths = tableMatch[1].trim();
      continue;
    }

    const applyMatch = trimmed.match(/^<!--\s*apply-next\s*:\s*(.+?)\s*-->$/);
    if (applyMatch) {
      state.pendingApplyNext = applyMatch[1].trim();
      continue;
    }

    const openMatch = trimmed.match(/^<!--\s*([a-zA-Z][a-zA-Z0-9]*)\s*(.*?)\s*-->$/);
    if (openMatch && !trimmed.startsWith('<!-- toc') && !trimmed.startsWith('<!-- columnbreak') && !trimmed.startsWith('<!-- image') && !trimmed.startsWith('<!-- table') && !trimmed.startsWith('<!-- apply-next')) {
      const tag = openMatch[1];
      const extraTokens = openMatch[2] ? openMatch[2].trim() : '';
      if (extraTokens && !isValidContainerTokens(extraTokens)) {
        result.push(lines[i]);
        continue;
      }

      if (extraTokens) {
        const parsed = parseApplyNext(extraTokens);
        let classAttr = tag;
        if (parsed.className) {
          classAttr = tag + ' ' + parsed.className;
        }
        let resultStr = `<div class="${escapeHtmlAttribute(classAttr)}"`;
        if (parsed.id) {
          resultStr += ` id="${escapeHtmlAttribute(parsed.id)}"`;
        }
        resultStr += '>';
        result.push(resultStr);
      } else {
        result.push(`<div class="${tag}">`);
      }
      continue;
    }

    const closeMatch = trimmed.match(/^<!--\s*\/([a-zA-Z][a-zA-Z0-9]*)\s*-->$/);
    if (closeMatch) {
      result.push('</div>');
      continue;
    }

    if (state.pendingImageCss && trimmed.match(/^!\[(.*?)\]\((.+?)\)$/) && !trimmed.startsWith('<!--')) {
      const css = state.pendingImageCss;
      state.pendingImageCss = null;
      const imageMatch = trimmed.match(/^!\[(.*?)\]\((.+?)\)$/);
      const alt = imageMatch ? imageMatch[1] : '';
      const src = imageMatch ? imageMatch[2].replace(/^<|>$/g, '') : '';
      result.push(`![${alt}](<${src}>){style="${escapeHtmlAttribute(css)}" marker="image-css"}`);
      continue;
    }

    if (state.pendingTableWidths && trimmed.startsWith('|')) {
      const widths = state.pendingTableWidths;
      state.pendingTableWidths = null;
      result.push(`<!-- TABLE_WIDTHS:${widths} -->`);
    }

    if (state.pendingApplyNext) {
      const apply = state.pendingApplyNext;
      state.pendingApplyNext = null;
      result.push(`<!-- APPLY_NEXT:${apply} -->`);
    }

    result.push(lines[i]);
  }

  return result.join('\n');
}

export function transformPageContent(pageContent, pageMeta) {
  const state = {
    layout: pageMeta.layout,
    warnings: [],
    pendingImageCss: null,
    pendingTableWidths: null,
    pendingApplyNext: null,
  };

  const transformed = transformDirectives(pageContent, state);
  const html = renderMarkdown(transformed);

  let processedHtml = html;

  processedHtml = processedHtml.replace(
    /<!--\s*TABLE_WIDTHS:(.+?)\s*-->\s*(<table[^>]*>)/g,
    (match, widths, tableTag) => {
      const tokens = widths.split(',').map(w => w.trim());
      let colgroup = '<colgroup>';
      for (const w of tokens) {
        colgroup += `<col style="width:${w};"/>`;
      }
      colgroup += '</colgroup>';
      return tableTag + '\n' + colgroup;
    }
  );

  processedHtml = processedHtml.replace(
    /<!--\s*APPLY_NEXT:(.+?)\s*-->/g,
    (match, attrs) => {
      return `<!-- APPLY_NEXT:${attrs} -->`;
    }
  );

  processedHtml = applyNextAttributes(processedHtml);

  return { html: processedHtml, warnings: state.warnings };
}

function applyNextAttributes(html) {
  return html.replace(/<!--\s*APPLY_NEXT:(.+?)\s*-->(\s*<([a-zA-Z][a-zA-Z0-9-]*)([^>]*)>)/g, (full, rawAttrs, nextTag, tagName, existingAttrs) => {
    const parsed = parseApplyNext(rawAttrs);
    if (!parsed.className && !parsed.id) {
      return nextTag;
    }

    let updatedAttrs = existingAttrs || '';

    if (parsed.id) {
      if (/\sid\s*=/.test(updatedAttrs)) {
        updatedAttrs = updatedAttrs.replace(/\sid\s*=\s*"[^"]*"/, ` id="${escapeHtmlAttribute(parsed.id)}"`);
      } else {
        updatedAttrs += ` id="${escapeHtmlAttribute(parsed.id)}"`;
      }
    }

    if (parsed.className) {
      const classMatch = updatedAttrs.match(/\sclass\s*=\s*"([^"]*)"/);
      if (classMatch) {
        const existing = classMatch[1].trim();
        const merged = existing ? `${existing} ${parsed.className}` : parsed.className;
        updatedAttrs = updatedAttrs.replace(/\sclass\s*=\s*"[^"]*"/, ` class="${escapeHtmlAttribute(merged)}"`);
      } else {
        updatedAttrs += ` class="${escapeHtmlAttribute(parsed.className)}"`;
      }
    }

    return `<${tagName}${updatedAttrs}>`;
  });
}

function parseApplyNext(rawAttrs) {
  const tokens = rawAttrs.trim().split(/\s+/).filter(Boolean);
  const classes = [];
  let id = null;

  for (const token of tokens) {
    if (token.startsWith('.')) {
      classes.push(token.slice(1));
    } else if (token.startsWith('#')) {
      id = token.slice(1);
    }
  }

  return {
    className: classes.length ? classes.join(' ') : null,
    id,
  };
}

function isValidContainerTokens(rawAttrs) {
  return /^[.#][a-zA-Z0-9_-]+(\s+[.#][a-zA-Z0-9_-]+)*$/.test(rawAttrs);
}

function escapeHtmlAttribute(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function extractHeadingContext(pageContent) {
  const match = pageContent.match(/^#\s+(.+?)$/m);
  if (match) return match[1];

  const h2match = pageContent.match(/^##\s+(.+?)$/m);
  if (h2match) return h2match[1];

  return null;
}
