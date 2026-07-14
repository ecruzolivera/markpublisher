---
status: complete
phase: 4
updated: 2026-07-14
---

# Implementation Plan

## Goal

Make the TOC paginator correctly advance through all reserved TOC pages when a theme uses multi-column TOC styling.

## Context & Decisions

| Decision | Rationale | Source |
| --- | --- | --- |
| Fix pagination in the renderer, not the book theme | The book theme correctly declares a two-column TOC, while the renderer's fit check only evaluates vertical overflow. | `ref:../../src/html/toc-script.js` |
| Preserve CSS-controlled column counts | Themes are the source of layout styling; the renderer should detect the effective rendered geometry rather than add a new TOC directive. | `ref:../../AGENTS.md`, `ref:file:///home/ernesto/TTRPG/La%20Sombra%20del%20Calabozo/La%20Sombra%20del%20Calabozo/themes/sombra/theme.css` |
| Treat entries outside the page content box as non-fitting | CSS multi-column layout creates additional horizontal columns when content exceeds visible columns. Those columns are clipped by `.page { overflow: hidden }`, so the next item must move to the next TOC placeholder. | `ref:../../src/html/toc-script.js`, `ref:file:///home/ernesto/TTRPG/La%20Sombra%20del%20Calabozo/La%20Sombra%20del%20Calabozo/themes/sombra/theme.css` |
| Add a browser-backed regression test using the production template | The defect depends on browser layout geometry (`getBoundingClientRect`), which HTML-string tests cannot exercise. Constructing fixtures with `buildHtmlDocument()` exercises the actual injected TOC script. | `ref:../../src/html/template.js`, `ref:../../src/pdf/generator.js`, `ref:../../package.json` |
| Use deterministic system fonts in the layout regression | The current TOC script paginates synchronously before the PDF generator awaits `document.fonts.ready`; the regression must not pass based on post-pagination font reflow. | `ref:../../src/html/template.js`, `ref:../../src/pdf/generator.js` |
| Do not alter `<!-- toc:pages=N -->` behavior | `pages=N` remains a fixed physical-page reservation and capacity limit. The change only ensures overflow crosses into subsequent reserved pages rather than hidden columns. | `ref:../../src/renderer/preprocessor.js`, `ref:../../src/html/toc-script.js` |

## Phase 1: Define And Reproduce [COMPLETE]

- [x] 1.1 Inspect the affected book's source and confirm it reserves four TOC pages with `<!-- toc:pages=4 levels=1,2,3 -->`. -> `ref:file:///home/ernesto/TTRPG/La%20Sombra%20del%20Calabozo/La%20Sombra%20del%20Calabozo/La%20Sombra%20del%20Calabozo.md`
- [x] 1.2 Confirm the generated HTML includes four `.toc-placeholder` elements, one on each reserved TOC page. -> `ref:file:///home/ernesto/TTRPG/La%20Sombra%20del%20Calabozo/La%20Sombra%20del%20Calabozo/output/La%20Sombra%20del%20Calabozo.html`
- [x] 1.3 Confirm the theme applies `column-count: 2`, `column-fill: auto`, and page-level clipping to TOC pages. -> `ref:file:///home/ernesto/TTRPG/La%20Sombra%20del%20Calabozo/La%20Sombra%20del%20Calabozo/themes/sombra/theme.css`
- [x] 1.4 Identify the defect: `entryFits()` checks only `rect.bottom`; it accepts entries rendered into hidden third-and-later columns. -> `ref:../../src/html/toc-script.js`
- [x] 1.5 Establish a minimal browser reproduction with a two-column TOC and enough headings to require at least three physical TOC pages. -> `ref:../../test/toc-columns.test.js`

## Phase 2: Implement Column-Aware Pagination [COMPLETE]

- [x] 2.1 Update `src/html/toc-script.js` with a helper that returns complete visible content bounds (`left`, `right`, and `bottom`) from the page rectangle and computed padding. -> `ref:../../src/html/toc-script.js`
- [x] 2.2 Update `entryFits()` to accept the current page and preserve the existing vertical fit check against the page-number/content bottom boundary. -> `ref:../../src/html/toc-script.js`
- [x] 2.3 Add horizontal fit checks using a separate `measurementEpsilon` (`0.5px`) while retaining the `2px` inward bottom safety gap. -> `ref:../../src/html/toc-script.js`
- [x] 2.4 Support left-to-right and right-to-left column flow by checking both horizontal boundaries rather than assuming overflow is always to the right. -> `ref:../../src/html/toc-script.js`
- [x] 2.5 Recalculate bounds for every candidate entry, accounting for preview scale transforms and grid repositioning while entries are appended. -> `ref:../../src/html/toc-script.js`
- [x] 2.6 Add `break-inside: avoid` and `page-break-inside: avoid` to `.toc-entry`. -> `ref:../../src/html/page-chrome.js`
- [x] 2.7 Defer TOC pagination until `document.fonts.ready` and expose `window.__tocReady`; wait for it before PDF creation. -> `ref:../../src/html/toc-script.js`, `ref:../../src/pdf/generator.js`
- [x] 2.8 Keep one-column TOCs unchanged and retain overflow warnings for entries that exceed every reserved page. -> `ref:../../src/html/toc-script.js`

## Phase 3: Add Regression Coverage [COMPLETE]

- [x] 3.1 Add `test/toc-columns.test.js` using Node's native test runner and Puppeteer. -> `ref:../../test/toc-columns.test.js`
- [x] 3.2 Build fixtures with `buildHtmlDocument()` and `generatePageChrome()` and load them from `file://` URLs. -> `ref:../../test/toc-columns.test.js`
- [x] 3.3 Cover a spanning first-page title, scaled preview pages, LTR and RTL two-column TOCs, one-column pagination, and exhausted-page overflow warnings. -> `ref:../../test/toc-columns.test.js`
- [x] 3.4 Await `window.__tocReady`, then assert completeness, source order, visible bounds, and warning behavior. -> `ref:../../test/toc-columns.test.js`
- [x] 3.5 Ensure temporary test files and Puppeteer browsers close in `finally` blocks. -> `ref:../../test/toc-columns.test.js`

## Phase 4: Verify With The Affected Book [COMPLETE]

- [x] 4.1 Run the project test suite after cleaning the documented stale fixture directories: `rm -rf test/fixtures test/assets-fixtures test/path-fixtures && npm test`. 98 tests passed. -> `ref:../../AGENTS.md`
- [x] 4.2 Build `/home/ernesto/TTRPG/La Sombra del Calabozo/La Sombra del Calabozo` without changing its existing TOC directive or theme CSS.
- [x] 4.3 Inspect the generated HTML after `window.__tocReady`; all four TOC pages receive entries (51, 54, 56, and 55) with no entries outside visible bounds.
- [x] 4.4 Confirm the overflow warning remains only because the existing four-page reservation is exhausted by one remaining entry.
- [x] 4.5 Generate the PDF after the PDF generator waits for `window.__tocReady`.

## Edge Cases

- A TOC page with a title (`Tabla de contenidos`) has less usable first-column height than later TOC pages; pagination must continue to rely on actual rendered geometry rather than fixed entry counts.
- A single TOC item taller than a column must retry on subsequent reserved pages, then leave the existing overflow warning when no reserved page can contain it; the implementation must not loop indefinitely.
- Themes without multi-column TOC CSS must retain current behavior.
- This change guarantees one- and two-column layouts. Add a three-column fixture before claiming support for three or more columns.
- The pagination algorithm must continue respecting hidden page numbers when calculating usable vertical space.
- TOC pagination waits for `document.fonts.ready`, and PDF generation waits for the resulting `window.__tocReady` promise before creating the document.

## Notes

- The book currently has four generated TOC pages (`p4`-`p7`), so the preprocessor is not dropping pages. `ref:file:///home/ernesto/TTRPG/La%20Sombra%20del%20Calabozo/La%20Sombra%20del%20Calabozo/output/La%20Sombra%20del%20Calabozo.html`
- No current test uses Puppeteer, but it is already available through the package dependency and used by the PDF generator. `ref:../../package.json`, `ref:../../src/pdf/generator.js`
