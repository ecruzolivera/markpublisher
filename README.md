# MarkPublisher

Convert extended Markdown (with HTML comment directives) into styled HTML and PDF for professional book publishing.

Requires **Node.js 22.12.0 or newer**. Development and CI also cover Node 24.

## Quick Start

```bash
# Create a new book project
npx create-markpublisher-book my-book
cd my-book
npx markpublisher serve
```

Or using npm:

```bash
npm install -g markpublisher
markpublisher init my-book
cd my-book
markpublisher serve
```

## Features

- **Two-column layout** via CSS multi-column with column breaks and spans
- **Hyperlinked table of contents** with dotted leaders and page numbers
- **Footnotes** via standard `[^1]` syntax
- **Tables with custom column widths** via `<!-- table: -->` directive
- **Image CSS directives** for per-image styling
- **Running headers** per page with chapter titles
- **Configurable page numbering** (arabic/none, persistent state)
- **Wikilink includes** (`![[path]]`) for multi-file projects, project-root-first resolution
- **Fenced containers** with nesting for styled blocks
- **Offline HTML output** — images, fonts, and CSS are bundled into `output/assets/`
- **Live-reload dev server** for preview while editing
- **Pagination toolbar** — zoom, single/facing spread, page navigation in both serve and build
- **Pluggable theme system** with CSS
- **PDF output** via Puppeteer with full paged-media support

## Configuration

Create a `markpublisher.toml` in your project root:

```toml
input = "book.md"
theme = "default"
outputDir = "./output"
name = "output"

[output]
html = true
pdf = true

[build]
failOnWarning = false

[serve]
port = 3000
```

Configuration is discovered upward from the current directory. Without a config file, the current directory is the project root, `book.md` is the input, and the default workflow settings apply. A `themes/default/theme.css` file must still be available through the theme search paths.

`name` sets the base filename for generated output (default `"output"`): the HTML and PDF are written as `output/<name>.html` and `output/<name>.pdf`.

`output.html`, `output.pdf`, and `build.failOnWarning` must be booleans. `serve.port` must be an integer from 1 to 65535. Unknown keys emit warnings, including keys inside these tables. Invalid TOML or schema values exit with code 2.

## Markdown Extensions (Directives)

All directives use HTML comment syntax so they're invisible in Obsidian, GitHub, and VS Code.

### Page Directives

| Directive                      | Description                            |
| ------------------------------ | -------------------------------------- |
| `<!-- pagebreak -->`           | Start a new page                       |
| `<!-- layout:twocol -->`       | Switch to two-column layout (default)  |
| `<!-- layout:singlecol -->`    | Switch to single-column layout         |
| `<!-- page-number:start=1 -->` | Enable arabic numbering, reset counter |
| `<!-- page-number:none -->`    | Hide page numbers                      |
| `<!-- header:show -->`         | Show running headers                   |
| `<!-- header:hide -->`         | Hide running headers                   |

Page directives persist across `pagebreak` boundaries until changed.

### Flow / Content Directives

| Directive                                             | Description                               |
| ----------------------------------------------------- | ----------------------------------------- |
| `<!-- columnbreak -->`                                | Force column break (ignored in singlecol) |
| `<!-- toc:pages=N -->`                                | Insert TOC, reserve N pages               |
| `<!-- toc:pages=N levels=1,2 -->`                     | Insert TOC with specific heading levels   |

Bare `<!-- toc -->` is deprecated and no longer inserts a TOC; use `<!-- toc:pages=N -->` instead.
| `<!-- toc-exclude -->`                                | Start excluding headings from TOC         |
| `<!-- /toc-exclude -->`                               | Stop excluding headings from TOC          |
| `<!-- image: width: 80%; border: 1px solid #ccc; -->` | Apply CSS to next image only              |
| `<!-- table: 25%, auto, 50% -->`                      | Set column widths for next table          |
| `<!-- apply-next:.myclass #myid -->`                  | Apply class/id to next block element      |
| `<!-- tag.class #id -->`                              | Open wrapper container                    |
| `<!-- /tag -->`                                       | Close wrapper container                   |

Open containers are closed in reverse nesting order at page breaks and at the end of the document, with warnings. Directives and includes inside fenced code examples remain literal; shorter fence markers do not close a longer fence.

Generated heading IDs are unique across the book, and footnote references/backlinks are scoped to their page. Explicit author IDs are preserved. Reusing an explicit ID produces an ambiguity warning with the conflicting locations; correct those IDs to make navigation reliable. `build.failOnWarning = true` makes these warnings fail the build with code 3.

### Wikilink Includes

```
![[chapter1]]
![[part1/intro.md]]
```

- Resolved project-root-first, falling back to source-file-relative
- `.md` appended if extension omitted
- Circular include detection (max depth 10)
- Missing files produce a visible `[Missing: path]` placeholder

## Front Matter Schema

```yaml
---
title: Book Title
author: Author Name
date: 2026-01-01
lang: en
---
```

## CLI Reference

```
markpublisher build      Build using markpublisher.toml
markpublisher serve      Start live-reload dev server
markpublisher init <name> Scaffold new project
```

Also available as a zero-config starter:

```
npx create-markpublisher-book my-book
```

Exit codes: 0 (success), 1 (file not found), 2 (invalid config), 3 (render error).

## Dev Server

```bash
markpublisher serve
```

- Serves `http://127.0.0.1:3000` on loopback only (configurable via `[serve].port`)
- Auto-reloads via SSE when input, includes, configuration, theme stylesheets, or local assets change
- Applies input/theme config edits live; changing the listen port requires restarting the server and emits a diagnostic
- Serves only registered image/font/theme assets, rather than exposing the entire project directory
- Pagination toolbar with zoom, single/facing spread, page navigation
- Recoverable error page for invalid edits; fixing the config/source restores preview without restarting

## Building

```bash
markpublisher build
# → output/<name>.html   (name defaults to "output")
# → output/<name>.pdf
```

Images, fonts, and CSS are bundled into `output/assets/` for offline output. Failed or unsupported references emit warnings and may remain unresolved; use local assets and inspect warnings for reproducible builds. The generated HTML includes the pagination toolbar for preview navigation. PDF generation uses Puppeteer (headless Chromium), which normally downloads its compatible browser during dependency installation. If install scripts were skipped, run `npx puppeteer browsers install chrome`.

PDF-only builds (`output.html = false`) use a unique temporary HTML file alongside the bundled assets. That temporary file is removed after success or failure; an existing normal HTML output is preserved.

## Pagination Toolbar

Both `serve` and `build` output include a toolbar with:

- **Zoom**: fit width, fit page, manual slider (10–300%)
- **Spread**: single page or facing pages
- **Settings**: column/row gap, page shadows, start-on-right
- **Navigation**: prev/next page, jump-to-page, page count
- **Keyboard**: ArrowLeft/ArrowRight for page navigation

## Theme System

Themes are directories containing a single `theme.css` file (no `theme.toml`). Search paths:

1. `<config-dir>/themes/<name>/` (project-local)
2. `./themes/<name>/` (cwd)
3. `~/.config/markpublisher/themes/<name>/` (user global)

### Page dimensions

PDF page size is parsed from theme CSS. Named `@page` sizes (A4, A5, Letter, Legal) take precedence over `.page` width/height. Custom sizes can use `@page { size: 6in 9in; }` or `.page { height: 9in; width: 6in; }`; declaration order and intervening properties do not matter. Absolute dimensions support `mm`, `cm`, `in`, `px`, `pt`, and `pc`. Explicit unsupported dimensions emit warnings. With no supported dimensions, the fallback is A4.

CSS imports preserve their media, layer, and supports conditions. Cyclic import edges are omitted with an import-chain warning, and nesting is limited to 32 stylesheets. Remote resources share in-flight downloads, with at most six concurrent fetches and a 30-second deadline per resource.

### CSS Conventions

The theme controls everything inside the page. The renderer provides page stacking, shadows, and toolbar styling.

| Class                 | Purpose                 | Owner    |
| --------------------- | ----------------------- | -------- |
| `.page`               | Page wrapper div        | Theme    |
| `.page.twocol`        | Two-column page         | Theme    |
| `.page.singlecol`     | Single-column page      | Theme    |
| `.page.toc`           | TOC page                | Theme    |
| `.page-number-hidden` | Page with hidden number | Theme    |
| `.column-break`       | Column break element    | Theme    |
| `.wide`               | Column-span all         | Theme    |
| `.running-header`     | Running header element  | Theme    |
| `.page-number`        | Page number element     | Theme    |
| `.page-shell`         | Preview shell wrapper   | Renderer |
| `.toc-link`           | TOC row anchor          | Renderer |
| `.toc-leader`         | Dotted leader spacer    | Renderer |
| `.toc-entry`          | TOC list item           | Renderer |
| `#pagination-toolbar` | Preview toolbar         | Renderer |

The `@page { size: ...; margin: 0; }` rule should be set, with margins handled by `.page` padding.

### Fonts

Themes can declare `@font-face` rules in CSS. Font files should be bundled in `themes/<name>/fonts/` for reproducible, offline-friendly builds.

Remote fonts (`@import` / `@font-face` with `http(s)` URLs) are supported but emit warnings, as output depends on network availability.

## Out of Scope (v1)

- Cross-references with auto page numbers ("see p. 42")
- Index generation
- Roman numeral page numbering
- EPUB export
- Automatic overflow pagination (content auto-reflow across pages)
- Math / LaTeX rendering
- SVG inline rendering
- Continuous PDF without pagebreak directives

## License

MIT
