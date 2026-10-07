import { transformPageContent, extractHeadingContext } from './index.js';
import { mapHtmlTags, getAttribute, setAttribute, removeAttribute } from '../html/tags.js';
import { generatePaginationToolbar } from '../html/pagination-toolbar.js';

const toolbarIds = [];
mapHtmlTags(generatePaginationToolbar(), tag => {
  const id = getAttribute(tag, 'id');
  if (id !== null) toolbarIds.push(id);
  return tag;
});

export async function renderDocument(result, rewriteAssets = html => html, warnings = []) {
  let headingContext = null;
  const pages = result.pages.map((meta, index) => {
    const content = meta.lines.join('\n');
    const empty = !content.trim();
    const rendered = empty ? { html: '', warnings: [] }
      : transformPageContent(content, meta, { documentScope: true, docId: `p${index + 1}` });
    warnings.push(...rendered.warnings);
    const heading = empty ? null : extractHeadingContext(content);
    if (heading) headingContext = heading;
    return {
      html: rendered.html,
      layout: meta.layout,
      pageRole: meta.tocPages > 0 ? 'toc' : 'body',
      headerText: empty ? null : headingContext,
      headerVisible: meta.headerVisible,
      numbering: meta.numbering,
      pageNumber: !empty && meta.numbering === 'arabic' ? meta.numberStart + meta.numberCounter : null,
    };
  });

  const used = new Map();
  for (const id of ['pages-container', 'pages-zoom-layer', ...toolbarIds, ...pages.map((_, i) => `p${i + 1}`)]) {
    used.set(id, 'renderer page chrome');
  }
  // Reserve explicit IDs across all pages before allocating any automatic ID.
  pages.forEach((page, index) => {
    mapHtmlTags(page.html, tag => {
      const id = getAttribute(tag, 'id');
      if (id === null || getAttribute(tag, 'data-mp-auto-id') !== null) return tag;
      const location = `${result.sourcePath || 'document'}, page ${index + 1}`;
      if (used.has(id)) warnings.push(`Duplicate explicit ID "${id}" at ${used.get(id)} and ${location}; links are ambiguous until the conflicting ID is corrected.`);
      else used.set(id, location);
      return tag;
    });
  });
  const suffixes = new Map();
  for (const page of pages) {
    page.html = mapHtmlTags(page.html, (tag, name) => {
      const base = getAttribute(tag, 'data-mp-auto-id')
        ?? (/^h[1-6]$/.test(name) && getAttribute(tag, 'id') === null ? 'heading' : null);
      if (base === null) return tag;
      let id = base;
      let suffix = suffixes.get(base) || 1;
      while (used.has(id)) id = `${base}-${suffix++}`;
      suffixes.set(base, suffix);
      used.set(id, 'generated heading');
      return setAttribute(removeAttribute(tag, 'data-mp-auto-id'), 'id', id);
    });
    page.html = await rewriteAssets(page.html);
  }
  return pages;
}
