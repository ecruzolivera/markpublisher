import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { preprocess } from '../src/renderer/preprocessor.js';
import { transformPageContent, extractHeadingContext } from '../src/renderer/index.js';
import { buildHtmlDocument } from '../src/html/template.js';
import { generatePageChrome } from '../src/html/page-chrome.js';
import { discoverTheme, getThemeCss } from '../src/themes/loader.js';

describe('end-to-end pipeline', () => {
  it('renders full document from markdown to HTML', () => {
    const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'markpublisher-e2e-'));

    const bookPath = path.join(fixtureDir, 'book.md');
    const bookContent = `---
title: Integration Test
author: Test
date: 2026-01-01
lang: en
---

# Chapter One

This is the first paragraph.

## Section 1.1

Some content with **bold** and *italic*.

<!-- pagebreak -->

## Section 1.2

More content.

| Name  | Value |
|-------|-------|
| Alpha | 1     |
| Beta  | 2     |

<!-- pagebreak -->

<!-- toc:pages=1 -->

<!-- pagebreak -->

# Chapter Two

Second chapter content.
`;

    fs.writeFileSync(bookPath, bookContent);

    const themeDir = path.join(fixtureDir, 'themes', 'default');
    fs.mkdirSync(themeDir, { recursive: true });
    fs.writeFileSync(path.join(themeDir, 'theme.css'), '@page { size: A4; margin: 0; }');

    const result = preprocess(bookPath);
    assert.ok(result.success, 'Preprocessing should succeed');
    assert.ok(result.pages.length >= 4, 'Should have at least 4 pages');
    assert.ok(result.pages.some(p => p.tocPages > 0), 'Should have TOC page');

    const themeResult = discoverTheme('default', [], fixtureDir);
    const themeCss = getThemeCss(themeResult);

    const pages = [];
    let headingContext = null;

    for (let i = 0; i < result.pages.length; i++) {
      const meta = result.pages[i];
      const content = meta.lines.join('\n');

      const { html } = transformPageContent(content, meta);

      const heading = extractHeadingContext(content);
      if (heading) headingContext = heading;

      const isToc = html.includes('class="toc-placeholder"');

      pages.push({
        html,
        layout: meta.layout,
        pageRole: isToc ? 'toc' : 'body',
        headerText: headingContext,
        headerVisible: meta.headerVisible,
        numbering: meta.numbering,
        pageNumber: null,
      });
    }

    const fullHtml = buildHtmlDocument(pages, themeCss, result.frontMatter, generatePageChrome());

    assert.ok(fullHtml.includes('<!DOCTYPE html>'));
    assert.ok(fullHtml.includes('<title>Integration Test</title>'));
    assert.ok(fullHtml.includes('page twocol'));
    assert.ok(fullHtml.includes('page-shell'));
    assert.ok(fullHtml.includes('Chapter One'));
    assert.ok(fullHtml.includes('toc-placeholder'));
    assert.ok(fullHtml.includes('toc-link'));
    assert.ok(fullHtml.includes('toc-leader'));
    assert.ok(fullHtml.includes('toc-entry'));
    assert.ok(fullHtml.includes('entryIdx'));
    assert.ok(fullHtml.includes('firstIncludedLevel'));
    assert.ok(fullHtml.includes('--toc-indent'));
    assert.ok(fullHtml.includes('TOC_EXCLUDE_START'));
    assert.ok(!fullHtml.includes('childStart'));
    assert.ok(!fullHtml.includes('rootIdx'));
    assert.ok(!fullHtml.includes('placedOnPage'));
    assert.ok(!fullHtml.includes('createDescendantEntry'));
    assert.ok(!fullHtml.includes('attachChildList'));
    assert.ok(fullHtml.includes('id="chapter-one"'));
    assert.ok(!fullHtml.includes('#undefined'));
    assert.ok(fullHtml.includes('Chapter Two'));
    assert.ok(fullHtml.includes('margin-left: calc(var(--toc-indent-step, 1.5em) * var(--toc-indent, 0));'));

    fs.rmSync(fixtureDir, { recursive: true, force: true });
  });

  it('includes data-toc-levels on placeholder when levels specified', () => {
    const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'markpublisher-e2e-'));

    const themeDir = path.join(fixtureDir, 'themes', 'default');
    fs.mkdirSync(themeDir, { recursive: true });
    fs.writeFileSync(path.join(themeDir, 'theme.css'), '@page { size: A4; margin: 0; }');

    const bookPath = path.join(fixtureDir, 'book.md');
    fs.writeFileSync(bookPath, `---
title: Levels Test
---

<!-- toc:pages=1 levels=2,3 -->

# Chapter
`);

    const result = preprocess(bookPath);
    assert.ok(result.success);

    const themeResult = discoverTheme('default', [], fixtureDir);
    const themeCss = getThemeCss(themeResult);

    const pages = [];
    for (let i = 0; i < result.pages.length; i++) {
      const meta = result.pages[i];
      const content = meta.lines.join('\n');
      const { html } = transformPageContent(content, meta);
      const heading = extractHeadingContext(content);
      const isToc = html.includes('class="toc-placeholder"');
      pages.push({
        html,
        layout: meta.layout,
        pageRole: isToc ? 'toc' : 'body',
        headerText: heading,
        headerVisible: meta.headerVisible,
        numbering: meta.numbering,
        pageNumber: null,
      });
    }

    const fullHtml = buildHtmlDocument(pages, themeCss, result.frontMatter, generatePageChrome());
    assert.ok(fullHtml.includes('data-toc-levels="2,3"'));
    assert.ok(fullHtml.includes('flatEntry.level - firstIncludedLevel'));
    assert.ok(!fullHtml.includes('createEntryLine(rootItem, 1)'));

    fs.rmSync(fixtureDir, { recursive: true, force: true });
  });

  it('preserves toc exclusion support in generated toc script', () => {
    const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'markpublisher-e2e-'));

    const themeDir = path.join(fixtureDir, 'themes', 'default');
    fs.mkdirSync(themeDir, { recursive: true });
    fs.writeFileSync(path.join(themeDir, 'theme.css'), '@page { size: A4; margin: 0; }');

    const bookPath = path.join(fixtureDir, 'book.md');
    fs.writeFileSync(bookPath, `---
title: Exclude Test
---

<!-- toc:pages=1 levels=1,2 -->

# Visible Chapter

<!-- toc-exclude -->
## Hidden Section
<!-- /toc-exclude -->

## Visible Section
`);

    const result = preprocess(bookPath);
    assert.ok(result.success);

    const themeResult = discoverTheme('default', [], fixtureDir);
    const themeCss = getThemeCss(themeResult);

    const pages = [];
    for (let i = 0; i < result.pages.length; i++) {
      const meta = result.pages[i];
      const content = meta.lines.join('\n');
      const { html } = transformPageContent(content, meta);
      const heading = extractHeadingContext(content);
      const isToc = html.includes('class="toc-placeholder"');
      pages.push({
        html,
        layout: meta.layout,
        pageRole: isToc ? 'toc' : 'body',
        headerText: heading,
        headerVisible: meta.headerVisible,
        numbering: meta.numbering,
        pageNumber: null,
      });
    }

    const fullHtml = buildHtmlDocument(pages, themeCss, result.frontMatter, generatePageChrome());
    assert.ok(fullHtml.includes('TOC_EXCLUDE_START'));
    assert.ok(fullHtml.includes('TOC_EXCLUDE_END'));
    assert.ok(fullHtml.includes('excludeDepth++'));
    assert.ok(fullHtml.includes('excludeDepth = Math.max(0, excludeDepth - 1)'));

    fs.rmSync(fixtureDir, { recursive: true, force: true });
  });

  it('renders empty document', () => {
    const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'markpublisher-e2e-'));

    const bookPath = path.join(fixtureDir, 'empty.md');
    fs.writeFileSync(bookPath, `---
title: Empty
---

`);
    const result = preprocess(bookPath);
    assert.ok(result.success);
    assert.equal(result.pages.length, 1);

    fs.rmSync(fixtureDir, { recursive: true, force: true });
  });

  it('handles front matter validation', () => {
    const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'markpublisher-e2e-'));

    const bookPath = path.join(fixtureDir, 'bad-front.md');
    fs.writeFileSync(bookPath, `---
title: Ok
bad_key: should warn
---

Content
`);
    const result = preprocess(bookPath);
    assert.ok(result.success);
    assert.ok(result.warnings.some(w => w.includes('Unknown front matter key')));

    fs.rmSync(fixtureDir, { recursive: true, force: true });
  });
});
