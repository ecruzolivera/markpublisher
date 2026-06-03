---
status: complete
phase: 6
updated: 2026-06-02
---

# Implementation Plan: Page Chrome Separation

## Goal

Add a renderer-controlled preview shell that makes generated HTML pages look like separated paper sheets in the browser using a dedicated `.page-shell` wrapper, while leaving all content and in-page layout entirely under theme control.

## Context & Decisions

| Decision | Rationale | Source |
|---|---|---|
| Renderer owns the `.page-shell` wrapper, theme owns everything inside `.page` | `.page-shell` provides an isolation layer: the renderer can apply preview chrome (shadow, break behavior) without ever touching `.page` selectors. Themes freely control page dimensions, columns, padding, headers, numbers, and typography. | User requirement |
| Page chrome CSS is injected **after** theme CSS in `<head>` | The renderer-owned preview shell should be authoritative for screen presentation — it must not be overridden by theme `body` rules or accidental `.page-shell` selectors in theme CSS. | `ref:./src/html/template.js`, `ref:./src/html/page-chrome.js` |
| Most preview styling lives on `#pages-container`, minimal use of `body` | `body` is commonly styled by themes; putting gap/padding on `#pages-container` reduces conflicts and keeps the shell independent of theme `body` rules. | `ref:./themes/default/styles.css`, `ref:./samples/sample-book/themes/demo/styles.css` |
| Shell CSS uses `@media screen` for preview and `@media print` resets for PDF | PDF generation uses print mode (Puppeteer default). Screen preview gets the paper-sheet look automatically. Print resets ensure no gaps/shadows in PDF output. | `ref:./src/pdf/generator.js` |
| No backward-compatibility concerns for external theme selectors | The project is in early development; themes are not yet distributed. The `.page-shell` wrapper is the correct architecture and should be locked in now. | User requirement |
| Do NOT move page geometry, columns, padding, headers, or numbering into the renderer | These are in-page layout decisions that belong to the theme. The renderer only provides the outer shell. | User requirement |

## Phase 1: Page Chrome Generator [COMPLETE]

- [x] **1.1 Update `src/html/page-chrome.js`**
- [x] 1.2 Refactor `generatePageChrome()` to produce shell-only CSS with padding on `#pages-container`, not `body`:
  ```css
  @media screen {
    body {
      background: #e8e8e8;
      margin: 0;
    }
    #pages-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 20px;
      padding: 20px 0;
    }
    .page-shell {
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
    }
  }
  @media print {
    body {
      background: transparent;
      margin: 0;
    }
    #pages-container {
      display: block;
      padding: 0;
    }
    .page-shell {
      box-shadow: none;
      break-inside: avoid;
      page-break-after: always;
    }
    .page-shell:last-child {
      page-break-after: auto;
    }
  }
  ```
- [x] 1.3 Explicitly NOT included in page chrome:
  - `.page` selectors of any kind
  - column layout (`column-count`, `column-gap`)
  - page dimensions (`width`, `height`)
  - page padding
  - running-header positioning
  - page-number positioning
  - any typography or component styles
- [x] 1.4 Add/update unit tests for `generatePageChrome()` in `test/page-chrome.test.js`

## Phase 2: Template Injection Order [COMPLETE]

- [x] 2.1 In `src/html/template.js`, change CSS injection order: theme CSS first, page chrome CSS after
  - Before: chrome → theme
  - After: theme → chrome
- [x] 2.2 Keep `.page-shell` wrapper around each `.page` div
- [x] 2.3 Keep `buildHtmlDocument(pages, themeStylesheetHref, frontMatter, pageChromeCss)` signature unchanged

## Phase 3: Build & Serve Integration [COMPLETE]

- [x] 3.1 Verify `src/commands/build.js` passes `generatePageChrome()` correctly (should be unchanged)
- [x] 3.2 Verify `src/commands/serve.js` passes `generatePageChrome()` correctly (should be unchanged)
- [x] 3.3 Verify both modes produce HTML with chrome CSS after theme CSS

## Phase 4: Theme CSS Preservation [COMPLETE]

- [x] 4.1 No changes to `themes/default/styles.css`
- [x] 4.2 No changes to `samples/sample-book/themes/demo/styles.css`
- [x] 4.3 Confirm theme still controls all `.page` internals: dimensions, columns, padding, headers, numbers

## Phase 5: Tests [COMPLETE]

- [x] 5.1 Update `test/page-chrome.test.js` to verify new CSS structure
- [x] 5.2 Update `test/e2e.test.js` if needed — keep `.page-shell` assertion
- [x] 5.3 Add test verifying chrome CSS appears after theme CSS in generated `<head>`
- [x] 5.4 Run full test suite — no regressions

## Phase 6: Verification [COMPLETE]

- [x] 6.1 Run `node --test test/**/*.test.js` — all tests pass
- [x] 6.2 Build `samples/sample-book` — HTML shows stacked paper sheets in browser
- [x] 6.3 Build `samples/sample-book` — PDF unchanged (no gaps or shadows)
- [x] 6.4 Serve `samples/sample-book` — browser shows stacked paper sheets with live reload
- [x] 6.5 Verify page chrome `<style>` block appears after theme styles in generated HTML

## Files Changed Summary

| File | Change |
|---|---|
| `src/html/page-chrome.js` | Refactor: padding on `#pages-container`, `body` only for background |
| `src/html/template.js` | Swap injection order: theme first, chrome after |
| `src/commands/build.js` | No change |
| `src/commands/serve.js` | No change |
| `test/page-chrome.test.js` | Update assertions to match new CSS |
| `test/e2e.test.js` | Minor update if needed |

## Notes

- 2026-06-02: The `.page-shell` wrapper is now the canonical architecture. It provides a clean isolation boundary between renderer-owned preview chrome and theme-owned page layout.
- 2026-06-02: CSS injection order is theme-first, chrome-last. This ensures the renderer's preview shell always wins for screen presentation regardless of what themes do with `body` or other shell-level selectors.
- 2026-06-02: `#pages-container` is the primary preview layout container. `body` only provides background color. This minimizes collisions with theme `body` styles.
- 2026-06-02: Implemented as planned. 66 tests passing. `page-chrome.js` refactored to put spacing on `#pages-container` with `body { margin: 0 }`. Template injects chrome CSS after theme CSS. Build output verified: theme stylesheet at line 9, chrome at line 10. 10 `.page-shell` wrappers in sample-book output. PDF unaffected.
