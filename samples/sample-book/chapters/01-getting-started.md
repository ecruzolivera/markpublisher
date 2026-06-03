<!-- layout:singlecol -->

# Chapter 1: Getting Started

This chapter introduces MarkPublisher, the sample project structure, and the two main commands: `serve` and `build`.

## What is MarkPublisher

MarkPublisher converts extended Markdown into styled HTML and PDF for professional book publishing. It uses HTML comment directives that are invisible in standard editors like VS Code, Obsidian, and GitHub.

Your book starts as plain Markdown files, and MarkPublisher handles layout, pagination, typography, and output generation.

## Project Structure

Open this sample project in your editor. You will see:

`book.md`
: The entry point. It contains front matter, a table of contents directive, and wikilink includes that pull in chapters.

`chapters/`
: Your content organized into one file per chapter. Each chapter is a regular Markdown file.

`partials/`
: Reusable snippets included with the `![[...]]` wikilink syntax. Use these for callouts, references, or anything repeated across chapters.

`images/`
: Image assets referenced from chapters using standard Markdown `![alt](image path)` or wikilink `![[path]]` syntax.

`themes/default/theme.css`
: The visual design. This single CSS file controls page size, fonts, colors, column layout, callout styles, headers, and page numbers.

`markpublisher.toml`
: Project configuration. Specifies the input file, theme, output directory, and build options.

<!--pagebreak-->

## markpublisher.toml

The sample project already has a working config:

```toml
input = "book.md"
theme = "default"
outputDir = "./output"

[output]
html = true
pdf = true

[build]
failOnWarning = false

[serve]
port = 3000
```

`input` points to the main book file. `theme` selects which theme directory to use. `outputDir` controls where build artifacts go. Everything is driven from this file -- there are no command-line flags to remember.

## Serve and Build

Run the dev server while you edit:

```bash
cd samples/sample-book
markpublisher serve
```

The dev server opens at `http://localhost:3000`. It reloads automatically when you edit any file in the project. Use it to preview your book as you write.

When you are ready to publish:

```bash
markpublisher build
```

This produces two output files:

- `output/output.html` -- a standalone HTML file with pagination toolbar, bundled images, and all CSS embedded
- `output/output.pdf` -- a print-ready PDF generated from the HTML

The build output is fully offline. All images, fonts, and CSS are bundled into `output/assets/`.

<!--pagebreak-->

## How to Read This Tutorial

Each chapter introduces a set of related features. Directives are shown with their exact syntax, a working example, and an explanation of what they do. The final chapter shows how to customize the default theme's CSS.

Try running `markpublisher serve` while reading, so you can see each example render live in your browser.

<!-- pagebreak -->
