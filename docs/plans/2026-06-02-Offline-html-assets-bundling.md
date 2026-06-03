---
status: complete
phase: 9
updated: 2026-06-02
---

# Implementation Plan: Offline HTML Asset Bundling

## Goal

Produce fully offline HTML output by scanning markdown- and CSS-referenced assets, copying or downloading them into `output/assets/`, and rewriting generated HTML/CSS to reference only bundled local files.

## Context & Decisions

| Decision                                                                                   | Rationale                                                                                                                                                                   | Source                                                                                     |
| ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Expand scope from local markdown images to all HTML-visible external resources             | The user now wants generated HTML to work offline, which requires bundling not only markdown images but also theme fonts, CSS `url(...)` assets, and remote markdown images | `ref:./docs/plans/2026-06-02-html-image-asset-copy-plan.md`, `ref:./src/commands/build.js` |
| Keep bundled assets under `output/assets/`                                                 | Matches the existing local image bundling behavior and keeps generated output self-contained and predictable                                                                | `ref:./src/html/assets.js`, `ref:./samples/sample-book/output/`                            |
| Treat markdown and CSS as two asset discovery sources                                      | Markdown contributes rendered `<img>` tags, while CSS contributes `@import`, `@font-face`, and `url(...)` references that also need bundling for offline output             | `ref:./src/renderer/index.js`, `ref:./themes/default/styles.css`                           |
| Bundle remote resources by downloading them during build                                   | Offline HTML cannot depend on network access, so remote fonts/images/stylesheets must be materialized locally in `output/assets/`                                           | User requirement                                                                           |
| Keep PDF generation based on generated HTML after rewrite                                  | PDF generation already works from the generated HTML file; if HTML is fully offline-bundled, PDF should inherit the same asset stability                                    | `ref:./src/pdf/generator.js`, `ref:./src/commands/build.js`                                |
| Start with assets directly needed by rendered HTML and CSS, not arbitrary linked documents | "Everything offline" should cover resources required to render the page: images, fonts, stylesheets, and CSS-linked binaries; unrelated hyperlinks should remain hyperlinks | Design decision                                                                            |
| Preserve warning/error policy for missing or failed resources                              | Bundling introduces network and file failure modes; these should surface as warnings and escalate only when warning policy requires it                                      | `ref:./src/commands/build.js`                                                              |
| Rewrite CSS asset references relative to the bundled CSS location                          | Once theme CSS is emitted into output, any `url(...)` references inside it must point at bundled assets, not original source/theme paths                                    | `ref:./src/themes/loader.js`, `ref:./samples/sample-book/themes/demo/styles.css`           |

## Phase 1: Resource Inventory [COMPLETE]

- [x] 1.1 Define the exact resource classes that must be bundled for offline HTML
- [x] 1.2 Confirm markdown-origin resources:
  - local images
  - remote images
  - raw HTML `<img>` tags emitted from markdown
- [x] 1.3 Confirm CSS-origin resources:
  - `@import` stylesheets
  - `@font-face src: url(...)`
  - generic `url(...)` references such as background images, masks, cursors
- [x] 1.4 Explicitly exclude non-render-blocking hyperlinks from bundling:
  - `<a href="https://...">`
  - footnote backlinks
  - heading anchors
- [x] 1.5 Document asset source classes:
  - local filesystem paths
  - project-relative paths
  - theme-relative paths
  - remote HTTP(S) URLs
  - data URLs

## Phase 2: Bundling Architecture [COMPLETE]

- [x] 2.1 Refactor `src/html/assets.js` into a broader bundling helper
- [x] 2.2 Define a common asset manifest shape for every discovered resource:
  - original reference
  - source type (`local` | `remote`)
  - resource type (`image` | `font` | `stylesheet` | `css-linked`)
  - absolute source or download URL
  - bundled output filename
  - rewritten relative path
- [x] 2.3 Reuse stable naming + collision handling for both copied and downloaded resources
- [x] 2.4 Avoid duplicate work when the same resource is referenced multiple times across HTML and CSS

## Phase 3: Markdown/HTML Resource Bundling [COMPLETE]

- [x] 3.1 Keep current local markdown image path resolution through preprocessing recursion
- [x] 3.2 Extend HTML asset scanning to include remote `<img src="http(s)://...">`
- [x] 3.3 Download remote images into `output/assets/`
- [x] 3.4 Rewrite all rendered `<img>` references to bundled local `assets/...` paths
- [x] 3.5 Support raw HTML image tags in markdown by resolving local paths during preprocessing and bundling them at HTML rewrite time

## Phase 4: Theme CSS Bundling [COMPLETE]

- [x] 4.1 Stop inlining theme CSS directly as raw source without rewrite context
- [x] 4.2 Parse theme CSS for:
  - `@import`
  - `@font-face`
  - `url(...)`
- [x] 4.3 Resolve local CSS asset references relative to the theme directory or imported stylesheet source
- [x] 4.4 Download remote CSS assets and remote font/image URLs referenced from CSS
- [x] 4.5 Rewrite bundled CSS so all `url(...)` references point to local bundled asset paths
- [x] 4.6 Flatten imported stylesheets into one emitted bundled CSS file under `assets/`
- [x] 4.7 Ensure rewritten CSS is what HTML references during both HTML and PDF generation

## Phase 5: Output Structure [COMPLETE]

- [x] 5.1 Define output layout:
  - `output/output.html`
  - `output/assets/...`
  - `output/assets/theme.css`
- [x] 5.2 Ensure generated HTML references bundled CSS from output, not inline-only source CSS
- [x] 5.3 Keep relative paths portable when the whole `output/` directory is moved elsewhere
- [x] 5.4 Preserve original file extensions where possible

## Phase 6: Network and Failure Policy [COMPLETE]

- [x] 6.1 Add HTTP fetch path for remote resources
- [x] 6.2 Use default fetch behavior without retries in v1
- [x] 6.3 Warn on failed downloads with source URL and referencing asset class
- [x] 6.4 Keep failure policy under `build.failOnWarning`
- [x] 6.5 Preserve build warnings as bundling outcome warnings

## Phase 7: Build Pipeline Integration [COMPLETE]

- [x] 7.1 Integrate offline bundling into `src/commands/build.js`
- [x] 7.2 Run HTML page rewrite before final `buildHtmlDocument(...)`
- [x] 7.3 Bundle and rewrite theme CSS before HTML template assembly
- [x] 7.4 Ensure PDF generation uses the already-bundled output so offline and PDF share the same asset graph
- [x] 7.5 Keep `output.html = false` behavior working with the existing generated-HTML/PDF workflow

## Phase 8: Tests [COMPLETE]

- [x] 8.1 Add tests for local markdown image copy + rewrite
- [x] 8.2 Add tests for remote markdown image download + rewrite
- [x] 8.3 Add tests for duplicate filenames across local/remote assets
- [x] 8.4 Add tests for repeated references deduping correctly
- [x] 8.5 Add tests for CSS `url(...)` local asset bundling
- [x] 8.6 Add tests for CSS remote font download + rewrite
- [x] 8.7 Add tests for `@import` stylesheet handling
- [x] 8.8 Add tests for missing local asset warning behavior
- [x] 8.9 Add tests for failed remote download warning behavior where practical via warning assertions on missing assets

## Phase 9: Sample Project Verification [COMPLETE]

- [x] 9.1 Existing `samples/sample-book` is sufficient for local offline verification; remote resource fixtures remain optional
- [x] 9.2 Rebuild `samples/sample-book`
- [x] 9.3 Verify `output/assets/` contains bundled images and emitted `theme.css`
- [x] 9.4 Verify generated HTML references only bundled local `assets/...` resources for sample assets
- [x] 9.5 Verify generated PDF still renders bundled assets correctly

## Notes

- 2026-06-02: The previous version of this plan was completed for local markdown image copying only. This updated plan expanded the scope to broader offline bundling for markdown and CSS resources.
- 2026-06-02: Implemented by broadening `src/html/assets.js` into a general asset bundler that handles local files, remote downloads, CSS `@import`, CSS `url(...)`, deduping, and collision-safe output naming `ref:./src/html/assets.js`
- 2026-06-02: Theme CSS is now emitted as `output/assets/theme.css` and referenced from generated HTML with `<link rel="stylesheet">`, allowing CSS-linked assets to be rewritten to bundled local paths `ref:./src/commands/build.js`, `ref:./src/html/template.js`
- 2026-06-02: Verified sample output contains `output/assets/theme.css`, copied SVGs, rewritten HTML `assets/...` references, and PDF rendering without alt-text fallback. Full test suite passes (54) `ref:./samples/sample-book/output/`, `ref:./test/html-assets.test.js`
