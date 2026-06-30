import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { preprocess, DIRECTIVE_PATTERNS } from '../src/renderer/preprocessor.js';

const TEST_DIR = path.join(import.meta.dirname || '.', 'fixtures');

function writeFixture(filename, content) {
  const dir = path.join(import.meta.dirname || '.', 'fixtures');
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, filename);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function cleanup() {
  const dir = path.join(import.meta.dirname || '.', 'fixtures');
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

describe('preprocessor', () => {
  it('extracts front matter', () => {
    writeFixture('test.md', `---
title: Test Book
author: Test Author
---

# Hello
`);
    const result = preprocess(path.join(TEST_DIR, 'test.md'));
    assert.ok(result.success);
    assert.equal(result.frontMatter.title, 'Test Book');
    assert.equal(result.frontMatter.author, 'Test Author');
    cleanup();
  });

  it('splits on pagebreak directives', () => {
    writeFixture('test.md', `---
title: Test
---

# Page 1

<!-- pagebreak -->

# Page 2

<!-- pagebreak -->

# Page 3
`);
    const result = preprocess(path.join(TEST_DIR, 'test.md'));
    assert.ok(result.success);
    assert.equal(result.pages.length, 3);
    cleanup();
  });

  it('handles layout directives', () => {
    writeFixture('test.md', `---
title: Test
---

# Default layout (twocol)

<!-- layout:singlecol -->

Single column content

<!-- pagebreak -->

<!-- layout:twocol -->

Two column again
`);
    const result = preprocess(path.join(TEST_DIR, 'test.md'));
    assert.ok(result.success);
    assert.equal(result.pages.length, 2);
    assert.equal(result.pages[0].layout, 'singlecol');
    assert.equal(result.pages[1].layout, 'twocol');
    cleanup();
  });

  it('handles page numbering directives', () => {
    writeFixture('test.md', `---
title: Test
---

<!-- page-number:start=1 -->

# Page 1

<!-- pagebreak -->

# Page 2

`);
    const result = preprocess(path.join(TEST_DIR, 'test.md'));
    assert.ok(result.success);
    assert.equal(result.pages[0].numbering, 'arabic');
    assert.equal(result.pages[1].numbering, 'arabic');
    cleanup();
  });

  it('handles page-number:none after start', () => {
    writeFixture('test.md', `---
title: Test
---

<!-- page-number:start=1 -->

# Page 1

<!-- pagebreak -->

<!-- page-number:none -->

# No number

<!-- pagebreak -->

# No number again
`);
    const result = preprocess(path.join(TEST_DIR, 'test.md'));
    assert.ok(result.success);
    assert.equal(result.pages[0].numbering, 'arabic');
    assert.equal(result.pages[1].numbering, 'none');
    assert.equal(result.pages[2].numbering, 'none');
    cleanup();
  });

  it('handles header show/hide directives', () => {
    writeFixture('test.md', `---
title: Test
---

<!-- header:show -->

# With header

<!-- pagebreak -->

<!-- header:hide -->

# Without header
`);
    const result = preprocess(path.join(TEST_DIR, 'test.md'));
    assert.ok(result.success);
    assert.equal(result.pages[0].headerVisible, true);
    assert.equal(result.pages[1].headerVisible, false);
    cleanup();
  });

  it('warns on unknown directives', () => {
    writeFixture('test.md', `---
title: Test
---

<!-- unknown:directive -->
`);
    const result = preprocess(path.join(TEST_DIR, 'test.md'));
    assert.ok(result.success);
    assert.ok(result.warnings.some(w => w.includes('Unknown directive')));
    cleanup();
  });

  it('resolves wikilink includes', () => {
    writeFixture('included.md', 'Included content here.');
    writeFixture('test.md', `---
title: Test
---

# Main

![[included]]
`);
    const result = preprocess(path.join(TEST_DIR, 'test.md'));
    assert.ok(result.success);
    const firstPageLines = result.pages[0].lines.join('\n');
    assert.ok(firstPageLines.includes('Included content here'));
    cleanup();
  });

  it('warns on missing includes', () => {
    writeFixture('test.md', `---
title: Test
---

![[missing]]
`);
    const result = preprocess(path.join(TEST_DIR, 'test.md'));
    assert.ok(result.success);
    assert.ok(result.warnings.some(w => w.includes('Missing include')));
    cleanup();
  });

  it('tracks referenced include paths even when missing', () => {
    writeFixture('test.md', `---
title: Test
---

![[missing-chapter]]
`);
    const result = preprocess(path.join(TEST_DIR, 'test.md'));
    assert.ok(result.success);
    assert.ok(Array.isArray(result.referencedIncludeFiles));
    assert.ok(result.referencedIncludeFiles.some(p => p.endsWith('/missing-chapter.md')));
    cleanup();
  });

  it('detects circular includes', () => {
    writeFixture('a.md', '![[b]]');
    writeFixture('b.md', '![[a]]');
    writeFixture('test.md', `---
title: Test
---

![[a]]
`);
    const result = preprocess(path.join(TEST_DIR, 'test.md'));
    assert.ok(result.success);
    assert.ok(result.warnings.some(w => w.includes('Circular')));
    cleanup();
  });

  it('resolves wikilinks from project root when projectRoot is provided', () => {
    const chaptersDir = path.join(TEST_DIR, 'chapters');
    const partialsDir = path.join(TEST_DIR, 'partials');
    fs.mkdirSync(chaptersDir, { recursive: true });
    fs.mkdirSync(partialsDir, { recursive: true });
    fs.writeFileSync(path.join(partialsDir, 'glossary.md'), 'Glossary content here.');
    writeFixture(path.join('chapters', 'test.md'), `---
title: Test
---

# Chapter

![[partials/glossary]]
`);

    const result = preprocess(path.join(chaptersDir, 'test.md'), [], TEST_DIR);
    assert.ok(result.success);
    const firstPageLines = result.pages[0].lines.join('\n');
    assert.ok(firstPageLines.includes('Glossary content here'));
    cleanup();
  });

  it('falls back to source-relative wikilinks when not found at project root', () => {
    fs.mkdirSync(path.join(TEST_DIR, 'chapters'), { recursive: true });
    fs.writeFileSync(path.join(TEST_DIR, 'chapters', 'local.md'), 'Local content here.');
    writeFixture(path.join('chapters', 'test.md'), `---
title: Test
---

# Chapter

![[local]]
`);

    const result = preprocess(path.join(TEST_DIR, 'chapters', 'test.md'), [], TEST_DIR);
    assert.ok(result.success);
    const firstPageLines = result.pages[0].lines.join('\n');
    assert.ok(firstPageLines.includes('Local content here'));
    cleanup();
  });

  it('allows repeated identical includes on same page without circular warning', () => {
    fs.mkdirSync(path.join(TEST_DIR, 'partials'), { recursive: true });
    fs.writeFileSync(path.join(TEST_DIR, 'partials', 'tip.md'), 'Reusable tip.');
    writeFixture('test.md', `---
title: Test
---

# Main

![[partials/tip]]

![[partials/tip]]
`);

    const result = preprocess(path.join(TEST_DIR, 'test.md'), [], TEST_DIR);
    assert.ok(result.success);
    assert.ok(!result.warnings.some(w => w.includes('Circular')));
    const firstPageLines = result.pages[0].lines.join('\n');
    const matches = firstPageLines.match(/Reusable tip/g) || [];
    assert.equal(matches.length, 2);
    cleanup();
  });

  it('resolves local markdown image paths relative to source file', () => {
    const imagesDir = path.join(TEST_DIR, 'images');
    fs.mkdirSync(imagesDir, { recursive: true });
    fs.writeFileSync(path.join(imagesDir, 'cover.svg'), '<svg/>');
    writeFixture('test.md', `---
title: Test
---

![Cover](images/cover.svg)
`);

    const result = preprocess(path.join(TEST_DIR, 'test.md'));
    assert.ok(result.success);
    const firstPageLines = result.pages[0].lines.join('\n');
    assert.ok(firstPageLines.includes(`![Cover](${path.join(TEST_DIR, 'images', 'cover.svg').replace(/\\/g, '/')})`));
    cleanup();
  });

  it('resolves local markdown image paths inside included files relative to included file', () => {
    const chapterDir = path.join(TEST_DIR, 'chapters');
    const imagesDir = path.join(TEST_DIR, 'images');
    fs.mkdirSync(chapterDir, { recursive: true });
    fs.mkdirSync(imagesDir, { recursive: true });
    fs.writeFileSync(path.join(imagesDir, 'diagram.svg'), '<svg/>');
    fs.writeFileSync(path.join(chapterDir, 'chapter.md'), '![Diagram](../images/diagram.svg)');
    writeFixture('test.md', `---
title: Test
---

![[chapters/chapter]]
`);

    const result = preprocess(path.join(TEST_DIR, 'test.md'));
    assert.ok(result.success);
    const firstPageLines = result.pages[0].lines.join('\n');
    assert.ok(firstPageLines.includes(`![Diagram](${path.join(TEST_DIR, 'images', 'diagram.svg').replace(/\\/g, '/')})`));
    cleanup();
  });

  it('resolves wikilink includes with dotted stems', () => {
    const chaptersDir = path.join(TEST_DIR, 'chapters');
    fs.mkdirSync(chaptersDir, { recursive: true });
    fs.writeFileSync(path.join(chaptersDir, '02.1-reusable partials.md'), 'Partial using dotted stem.');
    writeFixture(path.join('chapters', 'test.md'), `---
title: Test
---

# Chapter

![[chapters/02.1-reusable partials]]
`);

    const result = preprocess(path.join(chaptersDir, 'test.md'), [], TEST_DIR);
    assert.ok(result.success);
    assert.ok(!result.warnings.some(w => w.includes('Missing include')));
    const firstPageLines = result.pages[0].lines.join('\n');
    assert.ok(firstPageLines.includes('Partial using dotted stem'));
    cleanup();
  });

  it('renders wikilink image includes as markdown images', () => {
    const imagesDir = path.join(TEST_DIR, 'images');
    fs.mkdirSync(imagesDir, { recursive: true });
    fs.writeFileSync(path.join(imagesDir, 'cover.svg'), '<svg/>');
    writeFixture('test.md', `---
title: Test
---

![[images/cover.svg]]
`);

    const result = preprocess(path.join(TEST_DIR, 'test.md'), [], TEST_DIR);
    assert.ok(result.success);
    const firstPageLines = result.pages[0].lines.join('\n');
    assert.ok(firstPageLines.includes('![cover]'));
    assert.ok(firstPageLines.includes('images/cover.svg'));
    assert.ok(!firstPageLines.includes('<svg/>'));
    cleanup();
  });

  it('resolves local raw html image paths relative to source file', () => {
    const imagesDir = path.join(TEST_DIR, 'images');
    fs.mkdirSync(imagesDir, { recursive: true });
    fs.writeFileSync(path.join(imagesDir, 'inline.svg'), '<svg/>');
    writeFixture('test.md', `---
title: Test
---

<img src="images/inline.svg" alt="Inline">
`);

    const result = preprocess(path.join(TEST_DIR, 'test.md'));
    assert.ok(result.success);
    const firstPageLines = result.pages[0].lines.join('\n');
    assert.ok(firstPageLines.includes(`src="${path.join(TEST_DIR, 'images', 'inline.svg').replace(/\\/g, '/')}"`));
    cleanup();
  });

  it('handles consecutive pagebreaks (empty pages)', () => {
    writeFixture('test.md', `---
title: Test
---

<!-- pagebreak -->

<!-- pagebreak -->

Content
`);
    const result = preprocess(path.join(TEST_DIR, 'test.md'));
    assert.ok(result.success);
    cleanup();
  });

  it('layout state persists across pagebreaks', () => {
    writeFixture('test.md', `---
title: Test
---

<!-- layout:singlecol -->

Page 1

<!-- pagebreak -->

Page 2

<!-- pagebreak -->

<!-- layout:twocol -->

Page 3
`);
    const result = preprocess(path.join(TEST_DIR, 'test.md'));
    assert.ok(result.success);
    assert.equal(result.pages[0].layout, 'singlecol');
    assert.equal(result.pages[1].layout, 'singlecol');
    assert.equal(result.pages[2].layout, 'twocol');
    cleanup();
  });

  it('container tags open and close', () => {
    writeFixture('test.md', `---
title: Test
---

<!-- note -->

Content inside

<!-- /note -->
`);
    const result = preprocess(path.join(TEST_DIR, 'test.md'));
    assert.ok(result.success);
    const lines = result.pages[0].lines.join('\n');
    assert.ok(lines.includes('<!-- note -->'));
    assert.ok(lines.includes('<!-- /note -->'));
    cleanup();
  });

  it('warns on unmatched close tag', () => {
    writeFixture('test.md', `---
title: Test
---

<!-- /note -->
`);
    const result = preprocess(path.join(TEST_DIR, 'test.md'));
    assert.ok(result.success);
    assert.ok(result.warnings.some(w => w.includes('Unmatched close tag')));
    cleanup();
  });

  it('handles toc:pages=N with single page', () => {
    writeFixture('test.md', `---
title: Test
---

## Table of Contents

<!-- toc:pages=1 -->

<!-- pagebreak -->

Content
`);
    const result = preprocess(path.join(TEST_DIR, 'test.md'));
    assert.ok(result.success);
    const tocPages = result.pages.filter(p => p.tocPages > 0);
    assert.equal(tocPages.length, 1);
    assert.equal(tocPages[0].tocPages, 1);
    assert.equal(tocPages[0].tocPageIndex, 0);
    assert.ok(tocPages[0].lines.includes('## Table of Contents'));
    assert.equal(result.pages.length, 2);
    assert.ok(result.pages[1].lines.join('\n').includes('Content'));
    cleanup();
  });

  it('handles toc:pages=N with multiple pages', () => {
    writeFixture('test.md', `---
title: Test
---

<!-- toc:pages=3 -->

<!-- pagebreak -->

Content
`);
    const result = preprocess(path.join(TEST_DIR, 'test.md'));
    assert.ok(result.success);
    const tocPages = result.pages.filter(p => p.tocPages > 0);
    assert.equal(tocPages.length, 3);
    assert.equal(tocPages[0].tocPages, 3);
    assert.equal(tocPages[0].tocPageIndex, 0);
    assert.equal(tocPages[1].tocPages, 3);
    assert.equal(tocPages[1].tocPageIndex, 1);
    assert.equal(tocPages[2].tocPages, 3);
    assert.equal(tocPages[2].tocPageIndex, 2);
    assert.equal(result.pages.length, 4);
    assert.ok(tocPages.every(page => page.layout === 'singlecol'));
    cleanup();
  });

  it('warns on old <!-- toc --> syntax without pages=N', () => {
    writeFixture('test.md', `---
title: Test
---

<!-- toc -->

Content
`);
    const result = preprocess(path.join(TEST_DIR, 'test.md'));
    assert.ok(result.success);
    assert.ok(result.warnings.some(w => w.includes('toc:pages')));
    cleanup();
  });

  it('handles toc:pages=N levels=1,2', () => {
    writeFixture('test.md', `---
title: Test
---

<!-- toc:pages=2 levels=1,2 -->

Content
`);
    const result = preprocess(path.join(TEST_DIR, 'test.md'));
    assert.ok(result.success);
    const tocPages = result.pages.filter(p => p.tocPages > 0);
    assert.equal(tocPages.length, 2);
    assert.ok(tocPages[0].lines.some(l => l.includes('toc:page=1 of=2 levels=1,2')));
    assert.ok(tocPages[1].lines.some(l => l.includes('toc:page=2 of=2 levels=1,2')));
    cleanup();
  });

  it('handles toc:pages=1 levels=2', () => {
    writeFixture('test.md', `---
title: Test
---

<!-- toc:pages=1 levels=2 -->
`);
    const result = preprocess(path.join(TEST_DIR, 'test.md'));
    assert.ok(result.success);
    const tocPages = result.pages.filter(p => p.tocPages > 0);
    assert.equal(tocPages.length, 1);
    assert.ok(tocPages[0].lines.some(l => l.includes('toc:page=1 of=1 levels=2')));
    cleanup();
  });

  it('handles toc:pages=1 levels=2,3 with comma spacing', () => {
    writeFixture('test.md', `---
title: Test
---

<!-- toc:pages=1 levels=2, 3 -->
`);
    const result = preprocess(path.join(TEST_DIR, 'test.md'));
    assert.ok(result.success);
    const tocPages = result.pages.filter(p => p.tocPages > 0);
    assert.equal(tocPages.length, 1);
    assert.ok(tocPages[0].lines.some(l => l.includes('toc:page=1 of=1 levels=2,3')));
    cleanup();
  });

  it('warns on toc levels with value 0', () => {
    writeFixture('test.md', `---
title: Test
---

<!-- toc:pages=1 levels=0 -->
`);
    const result = preprocess(path.join(TEST_DIR, 'test.md'));
    assert.ok(result.success);
    assert.ok(result.warnings.some(w => w.includes('levels must be 1, 2, or 3')));
    cleanup();
  });

  it('warns on toc levels with value 4', () => {
    writeFixture('test.md', `---
title: Test
---

<!-- toc:pages=1 levels=4 -->
`);
    const result = preprocess(path.join(TEST_DIR, 'test.md'));
    assert.ok(result.success);
    assert.ok(result.warnings.some(w => w.includes('levels must be 1, 2, or 3')));
    cleanup();
  });

  it('warns on toc levels with non-numeric values', () => {
    writeFixture('test.md', `---
title: Test
---

<!-- toc:pages=1 levels=h1,h2 -->
`);
    const result = preprocess(path.join(TEST_DIR, 'test.md'));
    assert.ok(result.success);
    assert.ok(result.warnings.some(w => w.includes('levels must be 1, 2, or 3')));
    cleanup();
  });

  it('carries levels through multiple TOC pages identically', () => {
    writeFixture('test.md', `---
title: Test
---

<!-- toc:pages=3 levels=1,3 -->
`);
    const result = preprocess(path.join(TEST_DIR, 'test.md'));
    assert.ok(result.success);
    const tocPages = result.pages.filter(p => p.tocPages > 0);
    assert.equal(tocPages.length, 3);
    tocPages.forEach(p => {
      assert.ok(p.lines.some(l => l.includes('levels=1,3')));
    });
    cleanup();
  });
});
