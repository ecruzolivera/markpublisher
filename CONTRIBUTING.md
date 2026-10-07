# Contributing

## Development Setup

```bash
git clone <repo>
cd markpublisher
nvm use
npm ci
```

Node.js 22.12.0 is the supported minimum; `.nvmrc` selects the current Node 24 patch for development. CI tests both the exact minimum and Node 24. There is no compile step. If Chromium was not installed by npm, run `npx puppeteer browsers install chrome`.

## Project Structure

```
src/
  cli.js              CLI entry point
  config.js           Configuration loader
  commands/
    build.js          Build command
    serve.js          Dev server command
    init.js           Project scaffolding
  renderer/
    markdown.js       markdown-it with plugins
    preprocessor.js   Directive + include system
    index.js          Pipeline orchestration, directive transform
    document.js       Shared page assembly and document-wide IDs
    fences.js         Shared Markdown fence state
    images.js         Markdown-aware image destination rewriting
  html/
    template.js       Full HTML document builder
    assets.js         Offline asset bundling
    css.js            Structural CSS import/URL processing
    resources.js      Bounded, deduplicated resource loading
    preview-assets.js Registered local preview assets
  pdf/
    generator.js      Puppeteer PDF generator
  themes/
    loader.js         Theme discovery + validation
  paths/
    resolver.js       Path resolution
  validate/
    config.js         Config schema validator
    frontmatter.js    Front matter schema validator

test/
  *.test.js           Test files

samples/
  sample-book/
    book.md           Canonical integration fixture
    markpublisher.toml
    themes/default/theme.css
```

## Running Tests

```bash
rm -rf test/fixtures test/assets-fixtures test/path-fixtures && npm test
```

Tests use Node's native runner, including browser-backed checks with Puppeteer. Put new fixtures in isolated temporary directories and register teardown for files, browsers, HTTP servers, SSE streams, and watchers. Local HTTP fixtures keep resource tests independent of external services.

`startPreviewServer({ cwd, portOverride: 0 })` is the internal test API. It returns `{ url, port, close }` after initial rendering/watch setup; await its idempotent `close()` in teardown. The CLI takes configuration from TOML and exposes no port flags.

Build the canonical example from `samples/sample-book/` with `node ../../src/cli.js build`. Integration tests use temporary copies to preserve local sample outputs.

## Design Philosophy

- **No overlap**: Theme geometry stays in `theme.css`, project config in `markpublisher.toml`
- **Single source of truth**: CLI is command-only, all config in files
- **Atomic predictability**: Shared parsing/page assembly uses per-document state, with explicit build/preview asset strategies
- **Trusted input**: CSS in image/table directives is applied as-is
- **Errors at the boundary**: Config loaders throw typed errors; the CLI maps them to exit codes, while preview recovers from invalid edits
