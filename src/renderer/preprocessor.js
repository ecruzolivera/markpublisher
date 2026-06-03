import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { resolveInclude, resolveWikiInclude, resolveProjectImage, resolveImage, normalizePath } from '../paths/resolver.js';
import { validateFrontmatter } from '../validate/frontmatter.js';

const MAX_INCLUDE_DEPTH = 10;

const DIRECTIVE_PATTERNS = {
  layout: /^<!--\s*layout\s*:\s*(twocol|singlecol)\s*-->$/,
  pagebreak: /^<!--\s*pagebreak\s*-->$/,
  pageNumber: /^<!--\s*page-number\s*:\s*(none|start\s*=\s*(\d+))\s*-->$/,
  headerShow: /^<!--\s*header\s*:\s*show\s*-->$/,
  headerHide: /^<!--\s*header\s*:\s*hide\s*-->$/,
  columnbreak: /^<!--\s*columnbreak\s*-->$/,
  toc: /^<!--\s*toc\s*:\s*pages\s*=\s*(\d+)(?:\s+levels\s*=\s*(.+?))?\s*-->$/,
  oldToc: /^<!--\s*toc\s*-->$/,
  tocExcludeStart: /^<!--\s*toc-exclude\s*-->$/,
  tocExcludeEnd: /^<!--\s*\/toc-exclude\s*-->$/,
  image: /^<!--\s*image\s*:\s*(.+?)\s*-->$/,
  table: /^<!--\s*table\s*:\s*(.+?)\s*-->$/,
  applyNext: /^<!--\s*apply-next\s*:\s*(.+?)\s*-->$/,
  openContainer: /^<!--\s*([a-zA-Z][a-zA-Z0-9]*)\s*(.*?)\s*-->$/,
  closeContainer: /^<!--\s*\/([a-zA-Z][a-zA-Z0-9]*)\s*-->$/,
};

export function preprocess(sourcePath, warnings = [], projectRoot) {
  const raw = fs.readFileSync(sourcePath, 'utf-8');
  const { data: rawFront, content } = matter(raw);

  const frontValidation = validateFrontmatter(rawFront, sourcePath);
  warnings.push(...frontValidation.warnings);
  if (frontValidation.errors.length) {
    return { success: false, errors: frontValidation.errors, warnings, pages: [], frontMatter: {} };
  }

  const frontMatter = frontValidation.data;

  const resolved = resolveIncludes(content, sourcePath, warnings, 0, new Set(), undefined, undefined, projectRoot);

  if (resolved.errors && resolved.errors.length) {
    return { success: false, errors: resolved.errors, warnings, pages: [], frontMatter };
  }

  const lines = resolved.content
    .split('\n')
    .filter(line => !line.startsWith('<!-- END_INCLUDE:'));

  const result = processDirectives(lines, warnings);

  const pages = splitPages(result.lines, result.state, warnings);

  return {
    success: true,
    errors: [],
    warnings,
    pages,
    frontMatter,
    includedFiles: Array.from(resolved.included),
    referencedIncludeFiles: Array.from(resolved.referenced),
  };
}

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

function resolveIncludes(content, sourcePath, warnings, depth, visited, included = new Set(), referenced = new Set(), projectRoot) {
  const lines = content.split('\n');
  const result = [];
  const errors = [];
  const fence = { inFence: false, marker: '' };

  if (depth > MAX_INCLUDE_DEPTH) {
    errors.push(`[${sourcePath}] Max include depth (${MAX_INCLUDE_DEPTH}) exceeded — possible circular reference`);
    return { content: content, errors, included, referenced };
  }

  for (const line of lines) {
    if (isFenceBoundary(line, fence)) {
      result.push(line);
      continue;
    }

    if (fence.inFence) {
      result.push(line);
      continue;
    }

    let match = line.match(/^!\[\[(.+?)\]\]$/);
    if (match) {
      const target = match[1].trim();
      const resolvedPath = resolveWikiInclude(target, projectRoot, sourcePath);
      const canonical = normalizePath(path.resolve(resolvedPath));
      referenced.add(canonical);

      if (!fs.existsSync(resolvedPath)) {
        warnings.push(`[${sourcePath}] Missing include: ${target}`);
        result.push(`[Missing: ${target}]`);
        continue;
      }

      if (visited.has(canonical)) {
        warnings.push(`[${sourcePath}] Circular include detected: ${target}`);
        result.push(`[Circular: ${target}]`);
        continue;
      }

      included.add(canonical);

      if (/\.(svg|png|jpg|jpeg|gif|webp)$/i.test(path.extname(target))) {
        const alt = path.basename(target, path.extname(target));
        result.push(`![${alt}](${canonical})`);
        result.push(`<!-- END_INCLUDE:${target} -->`);
        continue;
      }

      const includeContent = fs.readFileSync(resolvedPath, 'utf-8');
      const { content: includeBody } = matter(includeContent);
      const childVisited = new Set(visited);
      childVisited.add(canonical);
      const inner = resolveIncludes(includeBody, resolvedPath, warnings, depth + 1, childVisited, included, referenced, projectRoot);

      if (inner.errors && inner.errors.length) {
        errors.push(...inner.errors);
      }

      result.push(inner.content);
      result.push(`<!-- END_INCLUDE:${target} -->`);
      continue;
    }

    result.push(resolveWikilinkReferences(resolveLocalMarkdownImages(line, sourcePath, projectRoot), sourcePath, projectRoot, warnings, referenced));
  }

  return { content: result.join('\n'), errors: errors.length ? errors : null, included, referenced };
}

function resolveWikilinkReferences(line, sourcePath, projectRoot, warnings, referenced) {
  return line.replace(/(?<!\!)\[\[(.+?)\]\]/g, (fullMatch, target) => {
    const resolvedPath = resolveWikiInclude(target, projectRoot, sourcePath);
    const canonical = normalizePath(path.resolve(resolvedPath));
    referenced.add(canonical);

    if (!fs.existsSync(resolvedPath)) {
      warnings.push(`[${sourcePath}] Missing wikilink reference: ${target}`);
      return `[${target}]`;
    }

    const raw = fs.readFileSync(resolvedPath, 'utf-8');
    const { content: body } = matter(raw);
    const headingMatch = body.match(/^#\s+(.+)$/m);
    return headingMatch ? headingMatch[1].trim() : path.basename(target, path.extname(target));
  });
}

function resolveLocalMarkdownImages(line, sourcePath, projectRoot) {
  const rewrittenMarkdownImages = line.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (fullMatch, alt, rawTarget) => {
    const target = rawTarget.trim();

    if (!isLocalAssetTarget(target)) {
      return fullMatch;
    }

    const resolved = normalizePath(resolveProjectImage(target, sourcePath, projectRoot));
    return `![${alt}](${resolved})`;
  });

  return rewrittenMarkdownImages.replace(/<img\b([^>]*?)\ssrc=(['"])([^'"]+)\2([^>]*)>/gi, (fullMatch, beforeSrc, quote, rawTarget, afterSrc) => {
    const target = rawTarget.trim();

    if (!isLocalAssetTarget(target)) {
      return fullMatch;
    }

    const resolved = normalizePath(resolveProjectImage(target, sourcePath, projectRoot));
    return `<img${beforeSrc} src=${quote}${resolved}${quote}${afterSrc}>`;
  });
}

function isLocalAssetTarget(target) {
  return !/^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(target)
    && !target.startsWith('data:')
    && !target.startsWith('#');
}

function processDirectives(lines, warnings) {
  const result = [];
  const state = {
    layout: 'twocol',
    numbering: 'none',
    numberStart: 1,
    numberCounter: 0,
    headerVisible: false,
    headerText: null,
    openContainers: [],
    pendingImageCss: null,
    pendingTableWidths: null,
    pendingApplyNext: null,
    tocExclude: false,
    tocPages: 0,
  };
  const fence = { inFence: false, marker: '' };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (isFenceBoundary(line, fence)) {
      result.push(line);
      continue;
    }

    if (fence.inFence) {
      result.push(line);
      continue;
    }

    if (trimmed === '') {
      result.push(line);
      continue;
    }

    if (!trimmed.startsWith('<!--') || !trimmed.endsWith('-->')) {
      result.push(line);
      continue;
    }

    let matched = false;

    const layoutMatch = trimmed.match(DIRECTIVE_PATTERNS.layout);
    if (layoutMatch) {
      state.layout = layoutMatch[1];
      result.push(line);
      matched = true;
    }

    if (trimmed.match(DIRECTIVE_PATTERNS.pagebreak)) {
      if (state.openContainers.length) {
        warnings.push(`pagebreak auto-closes ${state.openContainers.length} open container(s): ${state.openContainers.join(', ')}`);
        state.openContainers = [];
      }
      result.push('<!-- pagebreak -->');
      matched = true;
    }

    const pageNumMatch = trimmed.match(DIRECTIVE_PATTERNS.pageNumber);
    if (pageNumMatch) {
      if (pageNumMatch[1] === 'none') {
        state.numbering = 'none';
      } else {
        state.numbering = 'arabic';
        state.numberStart = parseInt(pageNumMatch[2], 10);
        state.numberCounter = 0;
      }
      result.push(line);
      matched = true;
    }

    if (trimmed.match(DIRECTIVE_PATTERNS.headerShow)) {
      state.headerVisible = true;
      result.push(line);
      matched = true;
    }

    if (trimmed.match(DIRECTIVE_PATTERNS.headerHide)) {
      state.headerVisible = false;
      result.push(line);
      matched = true;
    }

    if (trimmed.match(DIRECTIVE_PATTERNS.columnbreak)) {
      result.push('<!-- columnbreak -->');
      matched = true;
    }

    const tocMatch = trimmed.match(DIRECTIVE_PATTERNS.toc);
    if (tocMatch) {
      const pages = parseInt(tocMatch[1], 10);
      if (pages < 1) {
        warnings.push(`TOC pages must be 1 or more, got ${pages}: ${trimmed}`);
      } else {
        state.tocPages = pages;

        let levels = '';
        if (tocMatch[2]) {
          const raw = tocMatch[2].replace(/\s+/g, '');
          const parsed = [...new Set(raw.split(','))].sort();
          const valid = parsed.filter(l => l === '1' || l === '2' || l === '3');
          const invalid = parsed.filter(l => l !== '1' && l !== '2' && l !== '3');
          if (invalid.length) {
            warnings.push(`TOC levels must be 1, 2, or 3, got: ${invalid.join(',')} in ${trimmed}`);
          }
          if (valid.length > 0) {
            levels = valid.join(',');
            state.tocLevels = valid.join(',');
          }
        }

        if (levels) {
          result.push(`<!-- toc:pages=${pages} levels=${levels} -->`);
        } else {
          result.push(`<!-- toc:pages=${pages} -->`);
        }
      }
      matched = true;
      continue;
    }

    if (trimmed.match(DIRECTIVE_PATTERNS.oldToc)) {
      warnings.push(`TOC directive requires pages=N, use <!-- toc:pages=1 --> instead of <!-- toc -->`);
      result.push(line);
      matched = true;
      continue;
    }

    if (trimmed.match(DIRECTIVE_PATTERNS.tocExcludeStart)) {
      state.tocExclude = true;
      result.push('<!-- toc-exclude -->');
      matched = true;
    }

    if (trimmed.match(DIRECTIVE_PATTERNS.tocExcludeEnd)) {
      state.tocExclude = false;
      result.push('<!-- /toc-exclude -->');
      matched = true;
    }

    const imageMatch = trimmed.match(DIRECTIVE_PATTERNS.image);
    if (imageMatch) {
      state.pendingImageCss = imageMatch[1].trim();
      result.push(line);
      matched = true;
    }

    const tableMatch = trimmed.match(DIRECTIVE_PATTERNS.table);
    if (tableMatch) {
      state.pendingTableWidths = tableMatch[1].trim();
      result.push(line);
      matched = true;
    }

    const applyMatch = trimmed.match(DIRECTIVE_PATTERNS.applyNext);
    if (applyMatch) {
      state.pendingApplyNext = applyMatch[1].trim();
      result.push(line);
      matched = true;
    }

    const closeMatch = trimmed.match(DIRECTIVE_PATTERNS.closeContainer);
    if (closeMatch) {
      const tag = closeMatch[1];
      if (!state.openContainers.length || state.openContainers[state.openContainers.length - 1] !== tag) {
        warnings.push(`Unmatched close tag: <!-- /${tag} --> at line ${i + 1}`);
      } else {
        state.openContainers.pop();
        result.push(`<!-- /${tag} -->`);
      }
      matched = true;
    }

    if (!matched) {
      const openMatch = trimmed.match(DIRECTIVE_PATTERNS.openContainer);
      if (openMatch) {
        const tag = openMatch[1];
        const rest = openMatch[2] || '';
        const isValidContainer = rest === '' || /^[.#][a-zA-Z0-9_-]+(\s+[.#][a-zA-Z0-9_-]+)*$/.test(rest);
        if (isValidContainer) {
          state.openContainers.push(tag);
          result.push(`<!-- ${tag}${rest ? ' ' + rest : ''} -->`);
          matched = true;
        }
      }
    }

    if (!matched) {
      warnings.push(`Unknown directive: ${trimmed}`);
      result.push(line);
    }
  }

  if (state.openContainers.length) {
    warnings.push(`${state.openContainers.length} unclosed container(s): ${state.openContainers.join(', ')}`);
  }

  return { lines: result, state };
}

function splitPages(lines, endState, warnings) {
  const pages = [];
  let currentLines = [];
  let layout = 'twocol';
  let numbering = 'none';
  let numberStart = 1;
  let numberCounter = 0;
  let headerVisible = false;
  let skipTocTrailingPagebreak = false;
  const fence = { inFence: false, marker: '' };

  function pushPage(pageLines, overrides = {}) {
    pages.push({
      lines: [...pageLines],
      layout: overrides.layout ?? layout,
      numbering,
      numberStart,
      numberCounter,
      headerVisible,
      tocPages: overrides.tocPages ?? 0,
      tocPageIndex: overrides.tocPageIndex ?? 0,
    });

    if (numbering === 'arabic') {
      numberCounter++;
    }
  }

  for (const line of lines) {
    if (isFenceBoundary(line, fence)) {
      currentLines.push(line);
      continue;
    }

    if (fence.inFence) {
      currentLines.push(line);
      continue;
    }

    const trimmed = line.trim();

    if (skipTocTrailingPagebreak && trimmed === '') {
      continue;
    }

    if (trimmed === '<!-- pagebreak -->') {
      if (skipTocTrailingPagebreak && currentLines.length === 0) {
        skipTocTrailingPagebreak = false;
        continue;
      }
      skipTocTrailingPagebreak = false;
      pushPage(currentLines);
      currentLines = [];
      continue;
    }

    skipTocTrailingPagebreak = false;

    const tocMatch = trimmed.match(DIRECTIVE_PATTERNS.toc);
    if (tocMatch) {
      const targetPages = parseInt(tocMatch[1], 10);
      const levelsSuffix = tocMatch[2] ? ` levels=${tocMatch[2].replace(/\s+/g, '')}` : '';

      currentLines.push(`<!-- toc:page=1 of=${targetPages}${levelsSuffix} -->`);
      pushPage(currentLines, { tocPages: targetPages, tocPageIndex: 0, layout: 'singlecol' });
      currentLines = [];

      for (let ti = 1; ti < targetPages; ti++) {
        currentLines.push(`<!-- toc:page=${ti + 1} of=${targetPages}${levelsSuffix} -->`);
        pushPage(currentLines, { tocPages: targetPages, tocPageIndex: ti, layout: 'singlecol' });
        currentLines = [];
      }
      skipTocTrailingPagebreak = true;
      continue;
    }

    const layoutMatch = trimmed.match(DIRECTIVE_PATTERNS.layout);
    if (layoutMatch) {
      layout = layoutMatch[1];
      continue;
    }

    const pageNumMatch = trimmed.match(DIRECTIVE_PATTERNS.pageNumber);
    if (pageNumMatch) {
      if (pageNumMatch[1] === 'none') {
        numbering = 'none';
      } else {
        numbering = 'arabic';
        numberStart = parseInt(pageNumMatch[2], 10);
        numberCounter = 0;
      }
      continue;
    }

    if (trimmed.match(DIRECTIVE_PATTERNS.headerShow)) {
      headerVisible = true;
      continue;
    }
    if (trimmed.match(DIRECTIVE_PATTERNS.headerHide)) {
      headerVisible = false;
      continue;
    }

    currentLines.push(line);
  }

  pushPage(currentLines);

  return pages;
}

export { DIRECTIVE_PATTERNS };
