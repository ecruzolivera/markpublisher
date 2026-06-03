---
status: complete
phase: 7
updated: 2026-06-04
---

# Implementation Plan: Eliminate theme.toml — CSS-Only Themes

## Goal

Remove `theme.toml` from the theme system. A theme becomes a single CSS file (`theme.css`) in a named directory. All geometry, layout, and PDF sizing is parsed from CSS. No duplication, no sync issues, no TOML validation.

## Context & Decisions

| Decision                                                                           | Rationale                                                                                                                                                                                               | Source                                                              |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `theme.toml` values duplicate CSS properties that theme authors must manually sync | `page_size` → `@page { size: }` + `.page { width; height; }`, `margins` → `.page { padding; }`, `columns` → `.page.twocol { column-count; column-gap; }`. Eliminating the TOML removes the sync burden. | `ref:./themes/default/theme.toml`, `ref:./themes/default/theme.css` |
| Parse `@page { size: }` and `.page { width; height; }` from CSS for PDF dimensions | These are the two CSS sources of page size. `@page` uses named sizes (A4, Letter). `.page` uses explicit dimensions (210mm, 297mm). Parsing both covers all cases.                                      | `ref:./src/pdf/generator.js`, `ref:./themes/default/theme.css`      |
| Directory name is the theme name                                                   | `themes/my-theme/theme.css` → name = `my-theme`. Convention-based, no configuration needed.                                                                                                             | Design decision                                                     |
| `theme.css` is always the entry point                                              | No `[assets].styles` list needed. Theme authors can use `@import` in CSS for additional files. The asset bundler already resolves `@import`.                                                            | `ref:./src/html/assets.js`                                          |
| Keep `PAGE_SIZES` registry in the new loader                                       | Needed to resolve named sizes like `A4` → `210mm × 297mm` for PDF generation. Moves from deleted `src/validate/theme.js` to `src/themes/loader.js`.                                                     | `ref:./src/validate/theme.js:1-6`                                   |
| Keep `toml` dependency for `markpublisher.toml`                                    | Project config (input, output, theme, serve port) is still TOML. Only `theme.toml` is removed.                                                                                                          | `ref:./src/config.js`                                               |

## Phase 1: CSS Parsing Helper [COMPLETE]

- [x] **1.1 Add `parseThemeCss(css)` to `src/themes/loader.js`**
  - Parse `@page { size: A4; }` → `{ format: 'A4' }`
  - Parse `.page { width: 210mm; height: 297mm; }` → `{ width: '210mm', height: '297mm' }` (for custom sizes without a `@page` rule)
  - Prefer `@page` over `.page` dimensions when both are present
  - Default to A4 if neither is found
  - Uses regex matching — no full CSS AST needed
  - Move `PAGE_SIZES` from `src/validate/theme.js` here

## Phase 2: Simplify Theme Loader [COMPLETE]

- [x] 2.1 Remove TOML parsing from `src/themes/loader.js`
  - Delete `toml.parse()` call, `validateTheme()` call, TOML format logic
  - `discoverTheme(themeName, warnings, configDir)` becomes:
    1. Find `themes/<name>/` directory (same search logic)
    2. Read `themes/<name>/theme.css` (convention — always the entry point)
    3. Call `parseThemeCss(css)` to extract PDF size
    4. Run `checkRemoteFonts(css, themeName, warnings)` using directory name
    5. Return `{ name, css, cssEntries, pdfSize }`
  - Previously returned `{ theme, css, cssEntries }` — theme object is gone
- [x] 2.2 Delete `src/validate/theme.js`
  - Move `PAGE_SIZES` constant to `src/themes/loader.js`
  - Remove `validateTheme()`, `ALLOWED_KEYS`, `PAGE_KEYS`, `COLUMNS_KEYS`, `HEADERS_KEYS`, `ASSETS_KEYS`, `DEFAULTS`
- [x] 2.3 No change to `package.json` — `toml` is still needed for `markpublisher.toml`

## Phase 3: Update PDF Generator [COMPLETE]

- [x] 3.1 Change `generatePdf(htmlPath, themeData, outputPath)` → `generatePdf(htmlPath, pdfSize, outputPath)`
  - `pdfSize` is `{ format: 'A4' }` or `{ width: '210mm', height: '297mm' }`
  - No longer needs or imports any theme object
- [x] 3.2 Update caller in `src/commands/build.js`
  - Pass `result.pdfSize` instead of `themeResult.theme`

## Phase 4: Update Build & Serve [COMPLETE]

- [x] 4.1 `src/commands/build.js`
  - `discoverTheme()` returns `{ name, css, cssEntries, pdfSize }`
  - Pass `pdfSize` to `generatePdf()`
- [x] 4.2 `src/commands/serve.js`
  - Same: use new return shape
  - Theme CSS inlining unchanged (`getThemeCss()` still works)
- [x] 4.3 `src/html/page-chrome.js`
  - No change — generates shell CSS only (stacking, toolbar, TOC), never used theme data

## Phase 5: Clean Up Theme Files [COMPLETE]

- [x] 5.1 Delete `themes/default/theme.toml`
- [x] 5.2 Delete `samples/sample-book/themes/default/theme.toml`
- [x] 5.3 Update `src/commands/init.js`
  - Stop reading/writing `theme.toml` during scaffold
  - The scaffolded `themes/default/` directory now contains only `theme.css` and `fonts/`

## Phase 6: Tests [COMPLETE]

- [x] 6.1 Rewrite `test/theme.test.js`
  - Replace TOML validation tests with CSS parsing tests
  - Test: `@page { size: A4; }` → correct format
  - Test: `.page { width: 210mm; height: 297mm; }` → correct dimensions
  - Test: default to A4 when nothing found
  - Test: `@page` wins over `.page` when both present
  - Test: custom size with `.page` dimensions
- [x] 6.2 Add theme loading test — `discoverTheme('default')` still works
- [x] 6.3 Run full test suite — no regressions

## Phase 7: Verification [COMPLETE]

- [x] 7.1 Run `node --test test/**/*.test.js` — all tests pass
- [x] 7.2 Build `samples/sample-book` — zero warnings
- [x] 7.3 Serve `samples/sample-book` — theme loads correctly
- [x] 7.4 Build PDF — correct page size
- [x] 7.5 `markpublisher init /tmp/test` — scaffolded project has no `theme.toml`, builds clean

## Files Changed Summary

| File                                            | Change                                                                             |
| ----------------------------------------------- | ---------------------------------------------------------------------------------- |
| `src/themes/loader.js`                          | Add `parseThemeCss()`, `PAGE_SIZES`; remove TOML logic; simplify `discoverTheme()` |
| `src/validate/theme.js`                         | **Delete**                                                                         |
| `src/pdf/generator.js`                          | Accept `pdfSize` instead of full theme object                                      |
| `src/commands/build.js`                         | Use new loader return shape, pass `pdfSize`                                        |
| `src/commands/serve.js`                         | Use new loader return shape                                                        |
| `src/commands/init.js`                          | Stop scaffolding `theme.toml`                                                      |
| `themes/default/theme.toml`                     | **Delete**                                                                         |
| `samples/sample-book/themes/default/theme.toml` | **Delete**                                                                         |
| `test/theme.test.js`                            | Rewrite for CSS parsing                                                            |

## Notes

- 2026-06-04: `theme.toml` duplicates CSS values. Theme authors must manually keep `page_size`, `margin_top`, `columns.default_count`, etc. in sync between TOML and CSS. CSS-only themes eliminate that problem — the CSS is the single source of truth.
- 2026-06-04: The `PAGE_SIZES` registry moves to the loader. It resolves named sizes (`A4` → `210mm × 297mm`) for PDF generation. The CSS parser uses it when encountering `@page { size: A4; }`.
- 2026-06-04: `markpublisher.toml` (project config) is not affected. This plan only removes `theme.toml`. Project config (input file, output directory, theme name, serve port) remains as TOML.
- 2026-06-04: Theme CSS files are not restructured. Geometry rules (`.page`, `.page.twocol`, `.running-header`, `.page-number`) stay in `theme.css` — the CSS parser only reads from them, it doesn't generate them.

- 2026-06-04: Implemented. 78 tests passing. theme.toml eliminated. parseThemeCss() extracts PDF dimensions from @page or .page CSS. Loader returns { name, css, cssEntries, pdfSize }. PDF generator accepts plain pdfSize object. Init no longer creates theme.toml. Sample-book builds and PDF renders correctly.
