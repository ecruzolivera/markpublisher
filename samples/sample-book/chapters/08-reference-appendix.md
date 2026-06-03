<!-- layout:singlecol -->

# Appendix: Directive and Theme Reference

This appendix provides a compact reference for every directive and CSS hook. Use it as a cheat sheet after reading the tutorial chapters.

## Directive Reference

### Page Directives

| Directive | Purpose | Persistent |
| --------- | ------- | ---------- |
| `<!-- pagebreak -->` | Start a new page | No |
| `<!-- layout:twocol -->` | Switch to two columns | Yes |
| `<!-- layout:singlecol -->` | Switch to one column | Yes |
| `<!-- page-number:start=N -->` | Enable numbering at N | Yes |
| `<!-- page-number:none -->` | Hide page numbers | Yes |
| `<!-- header:show -->` | Show running headers | Yes |
| `<!-- header:hide -->` | Hide running headers | Yes |

### One-Shot Directives

| Directive | Purpose | Affects |
| --------- | ------- | ------- |
| `<!-- columnbreak -->` | Force column break | Current column |
| `<!-- toc:pages=N -->` | Insert TOC, reserve N pages | Current page |
| `<!-- toc:pages=N levels=1,2 -->` | Insert TOC with specific heading levels | Current page |
| `<!-- image: CSS -->` | Style next image | Next image |
| `<!-- table: w1%, w2%, ... -->` | Set column widths | Next table |
| `<!-- apply-next:.class #id -->` | Add classes/id | Next block element |

### Exclusion Directives

| Directive | Purpose |
| --------- | ------- |
| `<!-- toc-exclude -->` | Exclude following headings from TOC |
| `<!-- /toc-exclude -->` | Stop excluding headings from TOC |

### Container Directives

| Directive | Purpose |
| --------- | ------- |
| `<!-- tag -->` | Open a `<div class="tag">` wrapper |
| `<!-- tag .class #id -->` | Open wrapper with extra classes and id |
| `<!-- /tag -->` | Close the wrapper |

Containers can be nested. `pagebreak` auto-closes any open containers.

### Wikilink Syntax

| Syntax | Purpose |
| ------ | ------- |
| `![[chapters/file]]` | Include a Markdown file |
| `![[partials/file]]` | Include a partial |
| `![[images/file.svg]]` | Include an image |

## Theme CSS Reference

### Page Structure

| Selector | Controls |
| -------- | -------- |
| `@page` | PDF paper size |
| `.page` | Page dimensions, padding, background |
| `.page.twocol` | Two-column layout |
| `.page.singlecol` | Single-column layout |

### Text and Typography

| Selector | Controls |
| -------- | -------- |
| `body` | Base font, size, color, line height |
| `h1, h2, h3` | Heading font, size, weight |
| `h1` | Chapter title size and column spanning |

### Page Chrome

| Selector | Controls |
| -------- | -------- |
| `.running-header` | Running header position and style |
| `.page-number` | Page number position and style |
| `.page-number::after` | Page number content rendering |
| `.page-number-hidden .page-number` | Hiding page numbers |

### Column Controls

| Selector | Controls |
| -------- | -------- |
| `.column-break` | Column break rendering |
| `.wide` | Full-width (span all columns) |

### Components

| Selector | Controls |
| -------- | -------- |
| `.note` | Callout container styling |
| `img` | Image defaults (max width, centering) |
| `table, th, td` | Table borders, padding, font size |

### Table of Contents

| Selector | Controls |
| -------- | -------- |
| `.toc-list` | TOC container (list style) |
| `.toc-entry` | TOC entry spacing |
| `.toc-link` | TOC link styling |
| `.toc-page-num` | TOC page number color |

### Custom Container Classes

Add your own CSS classes and use them with container directives:

```css
.my-callout {
  /* your styles */
}
```

```md
<!-- note .my-callout -->

Styled content.

<!-- /note -->
```

## File Layout

```
project/
  book.md              Entry point with front matter and includes
  markpublisher.toml   Project configuration
  chapters/            One file per chapter
  partials/            Reusable snippets
  images/              Image assets
  themes/default/      Theme directory
    theme.css          Visual design (single file)
  output/              Build artifacts
    output.html        Standalone HTML
    output.pdf         Print-ready PDF
    assets/            Bundled images, fonts, CSS
```

## Commands

```bash
markpublisher serve          # Dev server with live reload
markpublisher build          # Build HTML and PDF
markpublisher themes         # List available themes
markpublisher init <name>    # Scaffold a new project
```

## Entry Points

The main `book.md` should contain:

1. Front matter (`title`, `author`, `lang`)
2. Title page directives (`header:hide`, `page-number:none`, `layout:singlecol`)
3. A `<!-- toc:pages=N -->` directive for the table of contents
4. `![[chapters/...]]` includes for each chapter

Separate chapters with `<!-- pagebreak -->` directives.

<!-- pagebreak -->
