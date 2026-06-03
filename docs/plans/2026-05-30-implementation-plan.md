---
status: complete
phase: 11
updated: 2026-06-01
---

# Implementation Plan: MarkPublisher

## Goal

Build a CLI tool that converts extended Markdown (with HTML comment directives) into styled HTML and PDF for professional book publishing, supporting two-column layout, pagination, table of contents, table column widths, footnotes, images, running headers, configurable page numbering, front matter pages, and a pluggable theme system — with a live-reload dev server for preview.

## Context & Decisions

| Decision                                                                                                                                   | Rationale                                                                                                                                                  | Source                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| HTML comments `<!-- directive -->` for all markdown extensions                                                                             | Completely invisible in Obsidian, GitHub, VS Code, and every standard markdown viewer                                                                      | `ref:https://obsidian.md/help` — Obsidian skips HTML comments                     |
| `![[wikilink]]` for file includes                                                                                                          | Standard Obsidian syntax, familiar to users                                                                                                                | `ref:https://help.obsidian.md/Linking+notes+and+files/Internal+links#Embed+files` |
| markdown-it as parser                                                                                                                      | Plugin-rich, extensible, fast, large ecosystem                                                                                                             | `ref:https://github.com/markdown-it/markdown-it`                                  |
| Puppeteer for HTML→PDF                                                                                                                     | Reliable, full Chromium engine, best CSS paged-media support, can run JS post-processing for TOC                                                           | `ref:https://pptr.dev/`                                                           |
| Hybrid CLI + dev server                                                                                                                    | CLI for builds, dev server for live preview — no web editor needed, edit in Obsidian/VS Code                                                               | User preference                                                                   |
| CSS multi-column for two-column layout                                                                                                     | Proven approach (same as Homebrewery), good browser support, handles column breaks and spans naturally                                                     | `ref:https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_multicol_layout`        |
| CSS `@page` + `page` div dimensions for pagination                                                                                         | Reliable page sizing in both browser preview and Puppeteer PDF                                                                                             | `ref:https://developer.mozilla.org/en-US/docs/Web/CSS/@page`                      |
| Fenced div containers (`<!-- class -->` / `<!-- /class -->`) with nesting                                                                  | Simple parsing, supports classes + IDs via `.class` and `#id` syntax inside comments                                                                       | Design decision                                                                   |
| Theme system with TOML manifest (`theme.toml`) + CSS                                                                                       | Easy for users to create and share themes, no build step required                                                                                          | User preference (custom theme system first)                                       |
| All `<!-- directive -->` handling centralized in preprocessor, not split across pipeline stages                                            | Single pass before markdown-it avoids ambiguity; each directive has one consistent outcome (transformed, consumed, or passed through)                      | `ref:Law 3 — Atomic Predictability`                                               |
| Preprocessor passes `pagebreak` semantics to page splitter                                                                                 | Clean separation: preprocessor marks all directives, then page splitter only looks at `<!-- pagebreak -->` markers                                         | Design decision                                                                   |
| Running headers via HTML injection per page div                                                                                            | More reliable than CSS `string-set` (Puppeteer has limited support for CSS named strings); each page div gets a `<header>` element stamped during assembly | `ref:https://pptr.dev/` CSS support limitations                                   |
| `markdown-it-footnote` for footnotes                                                                                                       | Battle-tested, standard syntax (`[^1]`), essential for book publishing                                                                                     | `ref:https://github.com/markdown-it/markdown-it-footnote`                         |
| `markdown-it-deflist`, `markdown-it-abbr`, `markdown-it-attrs`, `markdown-it-sub`, `markdown-it-sup` as pre-installed plugins              | Useful for book content, negligible overhead, better to have and not need than need and not have                                                           | `ref:https://github.com/markdown-it/` ecosystem                                   |
| Gray-matter for YAML front matter                                                                                                          | Standard library, handles edge cases well                                                                                                                  | `ref:https://github.com/jonschlinkert/gray-matter`                                |
| Chokidar for file watching in dev server                                                                                                   | Reliable, cross-platform, handles recursive watching of includes                                                                                           | `ref:https://github.com/paulmillr/chokidar`                                       |
| Command-only CLI (no flags)                                                                                                                | Single source of truth in `markpublisher.toml`; avoids precedence conflicts and overlap                                                                    | Design decision                                                                   |
| Express for dev server                                                                                                                     | Lightweight, SSE support for live-reload                                                                                                                   | `ref:https://expressjs.com/`                                                      |
| `markpublisher.toml` config file                                                                                                           | Project-level runtime/build config (input/output/theme/workflow); no layout or page geometry                                                               | Design decision                                                                   |
| Long documents handled by building full HTML and passing to Puppeteer in one go                                                            | Simple, correct for reasonable book lengths (< 500 pages). If memory becomes an issue, future optimization can split.                                      | Design decision — v1 simplicity                                                   |
| Pagination model for v1 is manual page boundaries (`<!-- pagebreak -->`) with overflow warnings, not automatic content reflow across pages | Keeps v1 deterministic and avoids unstable layout heuristics across columns, footnotes, and mixed page layouts                                             | Scope control decision                                                            |
| Public directives are split into page directives and flow/content directives                                                               | Small, explicit API surface with predictable parser behavior                                                                                               | Design decision                                                                   |
| Default page layout is `layout:twocol`; layout state persists across `pagebreak` boundaries until changed                                  | Predictable multi-page authoring without repeated directives                                                                                               | Design decision                                                                   |
| Default page numbering mode is `none`; numbering state persists across `pagebreak` boundaries until changed                                | Explicit control over when visible numbering starts                                                                                                        | Design decision                                                                   |
| TOC page mapping comes from closest `.page` container metadata, not geometric `offsetTop/pageHeight` math                                  | Correct with mixed layouts, directive-driven numbering state, and suppressed page numbers                                                                  | Design decision                                                                   |
| Page numbering in v1 is directive-driven and arabic-only when enabled                                                                      | Keeps numbering model minimal and avoids conflicts with front matter or mixed numeral systems                                                              | Design decision                                                                   |
| HTML output mode is config-driven via `markpublisher.toml` (portable HTML with external/copied assets, not single-file inlined HTML)       | Useful for proofreading without introducing heavy inlining pipeline in v1                                                                                  | Scope control decision                                                            |
| Front matter, `markpublisher.toml`, and `theme.toml` all validated with explicit schemas; unknown keys warn                                | Prevents ambiguous behavior and late pipeline failures                                                                                                     | Design decision                                                                   |
| Path resolution centralized in one resolver for includes/images/themes/fonts across build and serve                                        | Avoids path drift and cross-platform inconsistencies                                                                                                       | Design decision                                                                   |
| Footnotes in v1 follow markdown-it output and author-controlled page breaks; no automatic per-physical-page redistribution                 | Keeps footnote behavior predictable without layout engine complexity                                                                                       | Scope control decision                                                            |
| No overlap rule: all theme/layout/page geometry settings live in `theme.toml`; project/build/runtime settings live in `markpublisher.toml` | Clear ownership boundaries and no precedence matrix between theme and project config                                                                       | Design decision                                                                   |
| Internal page-size registry with canonical names (`A4`, `A5`, `Letter`, `Legal`) plus `custom`                                             | Common sizes are easy to use while preserving custom trim support                                                                                          | Design decision                                                                   |
| `theme.toml` uses `[page].page_size`; standard values resolve from registry; `custom` requires explicit width/height                       | Deterministic geometry resolution without config overlap                                                                                                   | Design decision                                                                   |
| Theme `styles.css` may use remote fonts (`@import` / `@font-face` URLs), but local bundled fonts are the recommended production path       | Keeps v1 flexible for existing workflows while preserving reproducible/offline-friendly publishing guidance                                                | Design decision                                                                   |
| PDF generation waits for font readiness (`document.fonts.ready`) before rendering                                                          | Reduces fallback-font races and improves output consistency                                                                                                | Design decision                                                                   |
| Remote font usage emits warnings (URL included), not errors by default                                                                     | Makes network and licensing risk visible without blocking iteration                                                                                        | Design decision                                                                   |
| `image:` directive CSS is trusted input and applied as-is to the next image only                                                           | Keeps directive behavior simple and expressive for author-controlled styling                                                                               | Design decision                                                                   |
| Running headers are disabled by default and can be enabled via `theme.toml` or page directives                                             | Clear opt-in behavior; avoids accidental page chrome                                                                                                       | Design decision                                                                   |
| Header visibility state persists across `pagebreak` until changed                                                                          | Consistent with layout and page-number state semantics                                                                                                     | Design decision                                                                   |
| Wrapper containers do not cross page boundaries; `pagebreak` auto-closes open wrappers with warnings                                       | Keeps each page DOM self-contained and predictable                                                                                                         | Design decision                                                                   |

## Phase 1: Project Scaffolding & Dependencies [COMPLETE]

- [x] **1.1 Initialize npm project with `package.json`** (`package.json`)
- [x] 1.2 Install core dependencies: `markdown-it`, `gray-matter`, `chokidar`, `express`, `puppeteer`, `toml`, `markdown-it-footnote`, `markdown-it-deflist`, `markdown-it-attrs`, `markdown-it-abbr`, `markdown-it-sub`, `markdown-it-sup`
- [x] 1.3 Create directory structure: `src/renderer/`, `src/renderer/plugins/`, `src/html/`, `src/pdf/`, `src/themes/`, `src/paths/`, `src/validate/`, `src/commands/`, `themes/default/fonts/`, `test/`, `samples/`, `docs/`
- [x] 1.4 Define standard front matter schema (`src/validate/frontmatter.js`): `title`, `author`, `date`, `lang` (default: `en`)
- [x] 1.5 Set up `src/renderer/markdown.js` — configure markdown-it with all 6 plugins
- [x] 1.6 Write basic integration tests: markdown rendering, plugin activation, HTML output (`test/markdown.test.js`)
- [x] 1.7 Set up `test/` with test runner config (Node native `--test`)
- [x] 1.8 Test end-to-end: read `.md` → render → output valid HTML (`test/e2e.test.js`)

## Phase 2: Directive System [COMPLETE]

- [x] 2.1 Create `src/renderer/preprocessor.js` — centralized `<!-- directive -->` handler with all page and flow/content directives
- [x] 2.2 Container parser with nesting support; `pagebreak` auto-closes all open wrappers with warnings
- [x] 2.3 `<!-- pagebreak -->` split logic: splits text into array of page strings, preserves page-level layout/numbering/header state metadata on each segment
- [x] 2.4 Error handling: warn on unmatched close tags, unclosed tags at page end, unknown directives (pass through as-is with warning)
- [x] 2.5 Tests: all directive types, nesting, malformed directives, page-boundary behavior, state persistence across `pagebreak` (`test/preprocessor.test.js`)
- [ ] 2.6 Add overflow detection markers (pre-PDF and dev preview) — **deferred to v1.1** (not blocking)
- [x] 2.7 Directive semantics tests: layout state inheritance, numbering state inheritance, `columnbreak` in `singlecol` ignored, `image:` one-shot, `table:` one-shot, `apply-next` one-shot, header state persistence, `pagebreak` auto-close wrappers

## Phase 3: Wikilinks & Image Handling [COMPLETE]

- [x] 3.1 Wikilink resolution in preprocessor (`src/renderer/preprocessor.js`): `![[path]]` inline, relative to source dir, `.md` auto-append, circular detection (max depth 10), missing file placeholders
- [x] 3.2 Image handling: standard markdown images, `<!-- image: ... -->` one-shot CSS applied as inline style to next image only (trusted input), images decorated with `marker="image-css"` attribute
- [x] 3.3 Tests: wikilink resolution, circular detection, missing image paths (`test/preprocessor.test.js`)
- [x] 3.4 Centralize path resolver (`src/paths/resolver.js`): includes, image URLs, theme asset/font URLs, normalized canonical paths
- [x] 3.5 Tests: path normalization and resolution (`test/paths.test.js`)

## Phase 4: Default Theme & Layout System [COMPLETE]

- [x] 4.1 Create `themes/default/theme.toml` with full schema
- [x] 4.2 Create `src/themes/loader.js` — theme discovery, validation, page-size registry (`A4`/`A5`/`Letter`/`Legal`/`custom`), remote font detection, warning policy
- [x] 4.3 Create `themes/default/styles.css`: `@page`, `.page`, `.twocol`/`.singlecol`, `.column-break`, `.wide`, `.note`, `.running-header`, `.page-number`, typography, tables, footnotes, images, print media
- [x] 4.4 Tests: load default theme, verify CSS, page-size registry (`test/theme.test.js`)
- [x] 4.5 Theme ownership checks: project config rejects theme geometry keys (`src/validate/config.js`)
- [x] 4.6 Theme font policy: detect remote `@import`/`@font-face` with `http(s)` URLs, emit warnings with source URL and theme name

## Phase 5: HTML Template & Page Assembly [COMPLETE]

- [x] 5.1 Create `src/renderer/index.js` — orchestrate pipeline: read → preprocess → split pages → transform directives → markdown-it render → wrap in page divs
- [x] 5.2 Create `src/html/template.js`: DOCTYPE + `<html>` + `<head>` with theme CSS + metadata, `<body>` with all page divs, inline TOC injection script, inline image loading wait script
- [x] 5.3 Page pipeline: track `layout`, `numbering`, `numberStart`, `numberCounter`, `headerVisible`, `headerText`, `pageRole`, `pageNumber` per page
- [x] 5.4 Page numbering: default `none`, arabic-only when enabled, `page-number:start=N` resets counter, state persists across pagebreaks
- [x] 5.5 Running headers: disabled by default, `header:show`/`header:hide` toggles, heading context (`h1` preferred, `h2` fallback), injected as `<header class="running-header">`
- [x] 5.6 Tests: full page rendering in e2e test validates page divs, layouts, TOC placeholder
- [x] 5.7 Clarify v1 pagination: `pagebreak` is only hard boundary, no auto-flow overflow

## Phase 6: Table Widths & Footnotes [COMPLETE]

- [x] 6.1 Table widths: `<!-- table: 25%, auto, 50% -->` applies to next table only via `<colgroup>` injection in directive transform (`src/renderer/index.js`); supports `%`, `px`, `mm`, `auto` tokens
- [x] 6.2 Footnotes via `markdown-it-footnote`: standard `[^1]` syntax, multi-paragraph continuation, CSS for small text + separator line
- [x] 6.3 Tests: markdown-it footnote rendering in `test/markdown.test.js`

## Phase 7: Table of Contents [COMPLETE]

- [x] 7.1 `<!-- toc -->` rendered as `<nav id="toc-placeholder">` during directive transform
- [x] 7.2 TOC injection: inline `<script>` in `src/html/template.js` collects `h1`/`h2`/`h3` from body pages, resolves page metadata, builds nested `<ul>`/`<li>` with heading text + page number, respects `toc-exclude` / `toc-exclude-end` comment markers
- [x] 7.3 Tests: e2e test validates TOC placeholder injection

## Phase 8: PDF Generator [COMPLETE]

- [x] 8.1 Create `src/pdf/generator.js`: headless Puppeteer, `networkidle0` wait, `document.fonts.ready`, `page.pdf()` with format from theme page-size registry, `printBackground: true`, `margin: 0mm`
- [x] 8.2 Config-driven HTML output mode (`markpublisher.toml` `[output].html` / `[output].pdf` toggles)
- [x] 8.3 Progress logging: "Loading...", "Generating PDF...", "Done → output.pdf"
- [x] 8.4 Font strategy: theme `@font-face` in CSS, `themes/<name>/fonts/` directory, system font fallback
- [x] 8.5 Error handling: basic Puppeteer launch error path
- [x] 8.6 Performance note: single-pass full HTML (documented for < 500 pages)
- [ ] 8.7 Tests: PDF generation test — **deferred** (requires Chromium in CI, tested manually)
- [x] 8.8 Remote font warnings: detected in `src/themes/loader.js`, emitted as non-fatal warnings
- [ ] 8.9 Remote asset warnings in image CSS — **deferred to v1.1** (image directive CSS not parsed for URLs)

## Phase 9: CLI & Configuration [COMPLETE]

- [x] 9.1 Create `src/config.js` — search `markpublisher.toml` upward from cwd, TOML-only parser, full schema with defaults
- [x] 9.2 Create `src/cli.js` — command-only CLI: `build`, `serve`, `themes`, `init <name>`
- [x] 9.3 Implement `build` command (`src/commands/build.js`): preprocess → render → HTML + PDF output
- [x] 9.4 Implement `init` command (`src/commands/init.js`): scaffold `book.md`, `markpublisher.toml`, `themes/default/`
- [x] 9.5 Implement `themes` command (`src/commands/themes.js`): scan project + user config dirs
- [x] 9.6 Watch mode: chokidar in `src/commands/serve.js` (dev server watches input file)
- [x] 9.7 Error handling: exit codes (1 = file not found, 2 = invalid config, 3 = render error)
- [x] 9.8 `package.json` `bin`: `"markpublisher": "./src/cli.js"`
- [x] 9.9 Schema validators: `src/validate/frontmatter.js`, `src/validate/config.js`, `src/validate/theme.js` — required fields, type validation, defaults, unknown key warnings
- [x] 9.10 Warning policy: `build.failOnWarning` config key exists; remote font warnings emitted non-fatally by default

## Phase 10: Dev Server [COMPLETE]

- [x] 10.1 Create `src/commands/serve.js` — Express server: `GET /` renders full HTML via same pipeline, `GET /live` SSE endpoint, injected `<script>` for auto-reload, error overlay
- [x] 10.2 Chokidar watches input file for changes → SSE notify clients
- [x] 10.3 Port configuration via `markpublisher.toml` `[serve].port` (default: 3000)
- [ ] 10.4 Tests: serve tests — **deferred** (requires server lifecycle in test runner)
- [ ] Directory listing mode (when `input` is a directory) — **deferred to v1.1**

## Phase 11: Documentation & Polish [COMPLETE]

- [x] 11.1 README.md: quick start, complete syntax reference, front matter schema, theme creation guide, CLI reference + exit codes, fonts policy, dev server usage, config reference
- [x] 11.2 Example `samples/book.md` demonstrating all features
- [ ] 11.3 Example custom theme with annotations — **deferred** (default theme serves as reference)
- [x] 11.4 `.gitignore`, `LICENSE` (MIT), `CONTRIBUTING.md`
- [x] 11.5 Freeze v1 directive API exactly as listed in Phase 2

## Out of Scope for v1

| Feature                                                                     | Reason                                                                               | Possible Future            |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------- |
| Cross-references with auto page numbers (e.g., "see p. 42")                 | Requires two-pass render or `target-counter` CSS that Puppeteer doesn't support well | v2 with paged.js or Prince |
| Index generation                                                            | Requires word-level page tracking, very complex                                      | v2                         |
| Roman numeral page numbering                                                | Not supported in v1 (arabic-only directive model)                                    | v1.1                       |
| EPUB export                                                                 | Different output format, different constraints                                       | v2                         |
| Automatic overflow pagination (reflow/split content across page boundaries) | Requires robust layout engine behavior and complex content splitting heuristics      | v2                         |
| Math / LaTeX                                                                | `markdown-it-tex` exists but adds heavy dependency                                   | v1.1                       |
| SVG inline rendering                                                        | For diagrams; needs SVG-to-PDF fidelity                                              | v1.1                       |
| Continuous PDF (no `pagebreak` directives)                                  | Counter to book publishing goal                                                      | won't fix                  |

## Deferred to v1.1

| Task                                                           | Phase | Reason                                     |
| -------------------------------------------------------------- | ----- | ------------------------------------------ |
| Overflow detection markers (warnings on page content overflow) | 2.6   | Non-blocking for initial release           |
| Remote asset URL warnings in `image:` directive CSS            | 8.9   | Image CSS not parsed for remote URLs yet   |
| PDF generation automated tests                                 | 8.7   | Requires Chromium in CI environment        |
| Dev server automated tests                                     | 10.4  | Requires server lifecycle in test runner   |
| Directory listing mode in dev server                           | 10.1  | Edge case, not core flow                   |
| Example custom theme with annotations                          | 11.3  | Default theme serves as reference          |
| `build.watch` mode (CLI-level file watching + rebuild)         | 9.6   | Watch currently only in dev server context |

## For v2

- Add a bundle-style CLI command to fetch remote images/fonts and store them locally for offline builds.

## Notes

- 2026-05-30: Plan created; gaps identified during review and incorporated:
  - Footnotes, image handling, running headers, page numbering control, and final public directive set added
  - Directives centralized in preprocessor (single-pass) per Law of Atomic Predictability
  - Running headers via HTML injection per page div (more reliable than CSS `string-set` with Puppeteer)
  - Config-driven HTML output, TOML config file, and expanded plugin bundle added
  - Cross-references, index, EPUB deferred to out-of-scope
- 2026-06-01: All 11 phases implemented. 41 tests passing. Build pipeline verified end-to-end. Key files:
  - `src/renderer/preprocessor.js` — directive parsing, wikilink resolution, page splitting
  - `src/renderer/index.js` — directive transform + markdown-it rendering pipeline
  - `src/renderer/markdown.js` — markdown-it with 6 plugins
  - `src/html/template.js` — full HTML document + inline TOC injection script
  - `src/pdf/generator.js` — Puppeteer PDF with font readiness
  - `src/themes/loader.js` — theme discovery, validation, remote font detection
  - `src/config.js` — TOML config loader with upward search
  - `src/cli.js` — 4 commands: build, serve, themes, init
  - `src/paths/resolver.js` — centralized path resolution
  - `src/validate/*.js` — schema validators for front matter, config, theme
  - `themes/default/` — default theme with full CSS
  - `samples/book.md` — comprehensive sample demonstrating all features
  - 7 items deferred to v1.1 (see Deferred table above)
- 2026-06-01 (review fixes): 5 bugs identified in code review, all resolved:
  1. `image:`/`table:`/`apply-next:` directives now flow through `splitPages` as content lines and are parsed in `transformDirectives` — previously they were silently consumed in `processDirectives` and never reached the renderer
  2. Theme resolution now searches `./themes/` relative to config directory before package root — previously only searched package root, so project-local theme copies were ignored
  3. Page numbers now render via `attr(data-page-number)` on `.page-number` elements instead of a global CSS counter — `page-number:start=N` reset now affects visible output
  4. Dev server watches all `![[included]]` files via `includedFiles` array surfaced from `resolveIncludes` — previously only watched the main input file
  5. Build warnings now print after all phases, and `failOnWarning` enforcement triggers `process.exit(3)` — previously warnings printed too early and the config key was ignored
