# Contributing

## Development Setup

```bash
git clone <repo>
cd markpublisher
npm install
```

## Project Structure

```
src/
  cli.js              CLI entry point
  config.js           Configuration loader
  commands/
    build.js          Build command
    serve.js          Dev server command
    init.js           Project scaffolding
    themes.js         Theme listing
  renderer/
    markdown.js       markdown-it with plugins
    preprocessor.js   Directive + include system
    index.js          Pipeline orchestration, directive transform
    plugins/          Custom markdown-it plugins
  html/
    template.js       Full HTML document builder
  pdf/
    generator.js      Puppeteer PDF generator
  themes/
    loader.js         Theme discovery + validation
  paths/
    resolver.js       Path resolution
  validate/
    config.js         Config schema validator
    theme.js          Theme schema validator
    frontmatter.js    Front matter schema validator

themes/
  default/
    theme.toml        Default theme config
    styles.css        Default theme CSS
    fonts/            Bundled fonts directory

test/
  *.test.js           Test files

samples/
  book.md             Sample book demonstrating all features
```

## Running Tests

```bash
npm test
```

## Design Philosophy

- **No overlap**: Theme geometry stays in `theme.toml`, project config in `markpublisher.toml`
- **Single source of truth**: CLI is command-only, all config in files
- **Atomic predictability**: All directive handling centralized in the preprocessor
- **Trusted input**: CSS in image/table directives is applied as-is
