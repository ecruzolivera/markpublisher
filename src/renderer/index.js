import { renderMarkdown } from './markdown.js';
import { findCodeLines } from './fences.js';
import { isStandaloneImage } from './images.js';
import { removeAttribute } from '../html/tags.js';

export function transformDirectives(pageContent, state) {
  const lines = pageContent.split('\n');
  const result = [];
  let tocExcludeDepth = 0;
  const codeLines = findCodeLines(lines);
  state.containerDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    if (codeLines.has(i)) {
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

      state.containerDepth++;

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
      state.containerDepth = Math.max(0, state.containerDepth - 1);
      result.push('</div>');
      continue;
    }

    if (state.pendingImageCss && isStandaloneImage(trimmed)) {
      const css = state.pendingImageCss;
      state.pendingImageCss = null;
      result.push(`${lines[i]}{style="${escapeHtmlAttribute(css)}" marker="image-css"}`);
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

export function transformPageContent(pageContent, pageMeta, env = {}) {
  const state = {
    layout: pageMeta.layout,
    warnings: [],
    pendingImageCss: null,
    pendingTableWidths: null,
    pendingApplyNext: null,
  };

  const transformed = transformDirectives(pageContent, state);
  const html = renderMarkdown(transformed, env);

  // Unwrap standalone and linked images from paragraph tags to prevent
  // paragraph margins and block-formatting-context issues in multi-column layouts.
  let processedHtml = html.replace(/<p>\s*(<img\b[^>]*>)\s*<\/p>/g, '$1');
  processedHtml = processedHtml.replace(/<p>\s*(<a\b[^>]*>\s*<img\b[^>]*>\s*<\/a>)\s*<\/p>/g, '$1');

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
  processedHtml += '</div>\n'.repeat(state.containerDepth);

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
      updatedAttrs = removeAttribute(updatedAttrs, 'data-mp-auto-id');
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
