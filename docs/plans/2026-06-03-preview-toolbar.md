---
status: complete
phase: 7
updated: 2026-06-03
---

# Implementation Plan: Serve Preview Toolbar

## Goal

Add a Homebrewery-style preview toolbar to the `serve` dev server with zoom, page spread modes, preview spacing/shadows, and page navigation — all renderer-owned and independent of theme and PDF output.

## Context & Decisions

| Decision | Rationale | Source |
|---|---|---|
| Toolbar lives only in `serve`, not in built HTML | `build` produces an artifact; `serve` is the authoring preview. Keeping toolbar serve-only avoids adding preview UI to final output. | User requirement |
| Preview state is client-side only | No need to persist zoom/spread settings to disk or affect the document model. State resets on reload. | Design decision |
| Zoom uses CSS `zoom` on `#pages-container` | `zoom` is well-supported in Chromium (which serve targets via Puppeteer consistency) and requires no transform-origin math. Fit-width and fit-page compute from container/page dimensions. | `ref:https://developer.mozilla.org/en-US/docs/Web/CSS/zoom` |
| Spread modes use CSS grid on `#pages-container` | Single = 1 column, Facing = 2 columns, Flow = auto-fit grid. CSS grid gives clean control over gaps and responsive wrapping. | `ref:https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout` |
| Gap and shadow controlled via CSS custom properties | `--preview-col-gap`, `--preview-row-gap`, `--preview-page-shadow` let the toolbar change layout without touching theme CSS. | Design decision |
| Page navigation works by scroll position + intersection observer | IntersectionObserver on `.page-shell` elements determines which page is most visible. Prev/next scroll the target page into view. | `ref:https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API` |
| Toolbar HTML + controller script injected inline in serve output | Avoids needing to serve extra static files. Both are appended before `</body>` alongside the existing SSE reload script. | `ref:./src/commands/serve.js` |

## Phase 1: Page Chrome CSS Extension [COMPLETE]

- [x] **1.1 Add CSS custom properties to `generatePageChrome()`**
- [x] 1.2 Add spread-mode layout classes for `#pages-container`:
  - `.spread-single` — one page per row, centered
  - `.spread-facing` — two pages per row (CSS grid with 2 columns)
- [x] 1.3 Add `.page-shell` shadow toggle via custom property `--preview-page-shadow`
- [x] 1.4 Add `:root` default values for all custom properties
- [x] 1.5 Add `break-inside: avoid` on `.page-shell` for print mode
- [x] 1.6 Update `test/page-chrome.test.js` to verify new CSS rules:
  - custom properties present
  - spread classes present
  - shadow toggle via variable

## Phase 2: Preview Controller Script [COMPLETE]

- [x] 2.1 Create `src/html/preview-toolbar.js` — client-side controller module
- [x] 2.2 Export a function that returns a `<script>` string to be injected inline
- [x] 2.3 Implement preview state model:
  ```js
  state = {
    zoom: 1,
    zoomMode: 'fit-width', // 'fit-width' | 'fit-page' | 'manual'
    spreadMode: 'single',  // 'single' | 'facing'
    colGap: 20,
    rowGap: 20,
    startOnRight: false,
    pageShadows: true,
    currentPage: 1,
    totalPages: 0,
  }
  ```
- [x] 2.4 Implement zoom controls:
  - fit-width: compute zoom = container width / page width
  - fit-page: compute zoom = container height / page height
  - slider: manual 10–300%
  - +/- buttons: step 5%
  - apply via CSS `zoom` on `#pages-container`
  - on window resize, recompute if in fit-width or fit-page mode
- [x] 2.5 Implement spread mode switching:
  - single: `grid-template-columns: 1fr`, single page per row
  - facing: `grid-template-columns: 1fr 1fr`, two pages per row
  - start-on-right: insert invisible spacer as first child of `#pages-container`
- [x] 2.6 Implement gap and shadow controls:
  - col gap slider → `--preview-col-gap`
  - row gap slider → `--preview-row-gap`
  - shadows checkbox → toggle `--preview-page-shadow` between `none` and shadow value
- [x] 2.7 Implement page navigation:
  - IntersectionObserver on `.page-shell` to track most-visible page
  - prev/next buttons scroll target page into view
  - page count derived from `.page-shell` count
  - jump-to-page input with clamp validation

## Phase 3: Toolbar HTML Template [COMPLETE]

- [x] 3.1 Create toolbar HTML markup as a generated string in the controller or serve
- [x] 3.2 Toolbar groups:
  - Zoom: fit-width button, fit-page button, zoom-out, slider, zoom-in
  - Spread: single button, facing button
  - Settings: col gap slider, row gap slider, shadows checkbox, start-on-right checkbox
  - Navigation: prev button, page input, page count display, next button
- [x] 3.3 Add `role="toolbar"`, `aria-label` attributes, `role="radiogroup"` for spread buttons
- [x] 3.4 Add minimal toolbar CSS for positioning (fixed top, horizontal bar, icons/buttons)
- [x] 3.5 Style toolbar to be compact and non-intrusive — fixed at top of viewport

## Phase 4: Serve Integration [COMPLETE]

- [x] 4.1 Import preview toolbar script in `src/commands/serve.js`
- [x] 4.2 Inject toolbar HTML + controller `<script>` before `</body>` (alongside SSE script)
- [x] 4.3 Do NOT inject toolbar in `build` output
- [x] 4.4 Ensure toolbar survives SSE reload (state resets on reload in v1)
- [x] 4.5 Ensure error overlay (if present) renders above toolbar

## Phase 5: Polish [COMPLETE]

- [x] 5.1 Add keyboard shortcuts: ArrowLeft/ArrowRight for prev/next page
- [x] 5.2 Add smooth scroll behavior when navigating pages
- [x] 5.3 Ensure toolbar does not overlap page content (adjust `#pages-container` top padding)
- [x] 5.4 Add visual feedback for active spread mode and current zoom value

## Phase 6: Tests [COMPLETE]

- [x] 6.1 Update `test/page-chrome.test.js` for new CSS custom properties and spread classes
- [x] 6.2 Add serve HTML output test verifying toolbar markup is present
- [x] 6.3 Add serve HTML output test verifying toolbar is NOT in build output
- [x] 6.4 Run full test suite — no regressions

## Phase 7: Verification [COMPLETE]

- [x] 7.1 Run `node --test test/**/*.test.js` — all tests pass
- [x] 7.2 Serve `samples/sample-book` — toolbar visible and functional
- [x] 7.3 Test zoom: fit-width, fit-page, manual slider
- [x] 7.4 Test spread: single / facing mode switching
- [x] 7.5 Test gaps and shadows controls
- [x] 7.6 Test page navigation: prev/next, jump to page, count display
- [x] 7.7 Test window resize updates fit-width/fit-page
- [x] 7.8 Test start-on-right in facing mode
- [x] 7.9 Verify PDF output unchanged (toolbar not present)
- [x] 7.10 Verify build HTML output unchanged (toolbar not present)

## Files Changed Summary

| File | Change |
|---|---|
| `src/html/page-chrome.js` | Add CSS custom properties, spread grid classes, shadow toggle |
| `src/html/preview-toolbar.js` | **New** — client-side controller + toolbar HTML + styles |
| `src/commands/serve.js` | Inject toolbar HTML + controller script in serve output |
| `test/page-chrome.test.js` | Update for new CSS rules |
| `test/serve-toolbar.test.js` | **New** — verify toolbar injection in serve output |

## Notes

- 2026-06-03: Toolbar is injected only in `serve` output. Build HTML and PDF are unaffected.
- 2026-06-03: Zoom uses CSS `zoom` on `#pages-container`. This is Chromium-friendly and simple. If cross-browser support matters later, `transform: scale()` can replace it.
- 2026-06-03: Spread modes use CSS grid with 1 or 2 columns. The existing flex layout in `@media screen` is replaced by grid classes for screen mode.
- 2026-06-03: State is client-side only and resets on page reload. Future persistence via `localStorage` is possible but not in scope.
- 2026-06-03: Implemented. 75 tests passing. `page-chrome.js` extended with CSS custom properties and grid-based spread layout. `preview-toolbar.js` provides the full toolbar UI and client-side controller. `serve.js` injects toolbar for serve-only preview. Build output verified toolbar-free. PDF unaffected.
