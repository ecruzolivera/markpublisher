# AGENTS.md

## Project

Single-package Node.js CLI (ESM, `"type": "module"`). Converts extended Markdown into styled HTML/PDF for book publishing. No build/compile step — run directly with `node`.

## Commands

```bash
npm test              # Node native test runner (NOT jest/mocha)
npm run build         # node src/cli.js build
npm run serve         # node src/cli.js serve
```

**Test flakiness**: tests create temp dirs under `test/fixtures/`, `test/assets-fixtures/`, `test/path-fixtures/`. Stale fixtures from failed runs cause spurious failures. Always clean them first:

```bash
rm -rf test/fixtures test/assets-fixtures test/path-fixtures && npm test
```

No lint, typecheck, or format scripts exist — only `npm test`.

## Architecture

Pipeline: **preprocessor** → **directive transform** → **markdown-it** → **page assembly** → **HTML template** → **PDF generator**.

| Module | File | Responsibility |
|---|---|---|
| CLI entry | `src/cli.js` | 3 commands: build, serve, init |
| Preprocessor | `src/renderer/preprocessor.js` | Front matter, wikilinks, directives, page-split |
| Renderer | `src/renderer/index.js` | Directive→HTML transform, markdown-it pipeline |
| Markdown | `src/renderer/markdown.js` | markdown-it + 7 plugins (incl. anchor, attrs) |
| HTML template | `src/html/template.js` | DOCTYPE, TOC script, image-wait script |
| Page chrome | `src/html/page-chrome.js` | Renderer-owned CSS (page stacking, shadows, TOC layout) |
| Asset bundler | `src/html/assets.js` | Copies/downloads images/fonts/CSS into `output/assets/` |
| PDF generator | `src/pdf/generator.js` | Puppeteer, loads real HTML file via `page.goto(file://...)` |
| Theme loader | `src/themes/loader.js` | Discovery, validation, remote font detection |
| Config | `src/config.js` | TOML parser, upward search for `markpublisher.toml` |
| Path resolver | `src/paths/resolver.js` | Wikilinks, images, theme paths |
| Validators | `src/validate/*.js` | Front matter, config, theme schema validation |
| Pagination toolbar | `src/html/pagination-toolbar.*` | Toolbar HTML/JS (separate files, read via `fs.readFileSync`) |
| Init command | `src/commands/init.js` | Copies `samples/sample-book/`, replaces date in book.md |

## Key conventions

- **Config is command-only, no flags**. Everything comes from `markpublisher.toml`.
- **`create-markpublisher-book` bin** auto-runs `init` — no subcommand. Detected via `path.basename(process.argv[1])`.
- **Wikilinks** resolve project-root-first (`resolveWikiInclude`), fallback to source-file-relative.
- **Theme CSS is the single source of truth**. Themes are just a `theme.css` file in a named directory. No `theme.toml`. PDF page dimensions are parsed from `@page { size: A4; }` or `.page { width; height; }` in the CSS. The directory name is the theme name.
- **Init command** copies `samples/sample-book/` (excluding `output/`) and replaces the date line in `book.md`. Everything else — including `.marksman.toml`, `README.md`, and `themes/` — is copied as-is. Does NOT run `git init`.
- **Serve toolbar** injects CSS before `</head>` and toolbar HTML before `</body>`. Toolbar padding must be server-side, not client-side JS.
- **PDF generation** loads the written HTML file via `page.goto(file://...)`, not `page.setContent()`.
- **Exit codes**: 0=success, 1=file not found, 2=invalid config, 3=render error.
- **Sample project**: `samples/sample-book/` is the canonical integration test fixture. Build it with `node src/cli.js build` from that directory.
- **`.marksman.toml`** in sample project sets `wiki.style = "file-path-stem"`.

## Browser scripts (separate files, not inline)

These are plain JS files read via `fs.readFileSync` and injected as `<script>` blocks:

| File | Injected by | Purpose |
|---|---|---|
| `src/html/toc-script.js` | template.js | TOC collection + rendering |
| `src/html/image-wait-script.js` | template.js | Image load wait for PDF |
| `src/html/sse-reload-script.js` | serve.js | Live-reload EventSource |
| `src/html/pagination-toolbar-script.js` | pagination-toolbar.js | Zoom/spread/navigation controls |
| `src/html/pagination-toolbar.html` | pagination-toolbar.js | Toolbar DOM markup |

When editing these, they are plain JS/HTML files — no template literal escaping needed.
