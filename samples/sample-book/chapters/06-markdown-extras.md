<!-- layout:singlecol -->

# Chapter 6: Markdown Extras

This chapter covers Markdown features beyond directives that MarkPublisher supports: footnotes, definition lists, abbreviations, subscripts, and superscripts.

## Footnotes

Use standard `[^identifier]` syntax to create footnotes[^1]. MarkPublisher uses the `markdown-it-footnote` plugin to render them.

Multi-paragraph footnotes continue with indentation[^fn-demo].

[^1]: This is a simple footnote. The reference in the text is `[^1]` and this is the definition block.

[^fn-demo]: This footnote has multiple paragraphs.

    The indented second paragraph continues the same footnote. This is useful for longer explanatory notes that need more space.

    You can even include a third paragraph.

Footnotes appear at the bottom of the page. Each is linked from its reference in the text.

## Definition Lists

Definition lists use the standard Markdown syntax with `:` as the definition marker:

Syntax:

```md
Term
: Definition of the term.
```

Examples:

Directive
: An HTML comment that controls MarkPublisher's rendering behavior. Directives are invisible in standard Markdown editors.

Theme
: A named directory containing a `theme.css` file that controls page size, typography, colors, and component styling.

Include
: A `![[path]]` wikilink that inlines the content of another Markdown file.

One-shot Directive
: A directive that affects only the next element, then is consumed. `image:`, `table:`, and `apply-next:` are one-shot directives.

Persistent Directive
: A directive whose state continues across page breaks until explicitly changed. `layout:`, `page-number:`, and `header:` are persistent directives.

## Abbreviations

Define abbreviations with `*[abbreviation]: expansion` syntax:

```md
*[HTML]: HyperText Markup Language
*[CSS]: Cascading Style Sheets
*[PDF]: Portable Document Format
```

Abbreviations appear with a dotted underline, and hovering shows the full expansion. This is powered by the `markdown-it-abbr` plugin.

Define abbreviations anywhere in the document. They are collected and applied globally.

*[HTML]: HyperText Markup Language
*[CSS]: Cascading Style Sheets
*[PDF]: Portable Document Format
*[TOC]: Table of Contents
*[CLI]: Command Line Interface

## Subscript and Superscript

Use `~subscript~` and `^superscript^` for inline subscripts and superscripts:

- Water: H~2~O
- Einstein's equation: E = mc^2^
- Chemical notation: CO~2~, NH~3~
- Mathematical: x^2^ + y^2^ = z^2^
- Ordinals (French): 1^er^, 2^e^

These are powered by `markdown-it-sub` and `markdown-it-sup`.

## Inline HTML

Standard inline HTML tags are supported:

Use <strong>bold</strong>, <em>italic</em>, <code>code</code>, and <mark>highlighted text</mark> if needed alongside Markdown.

Raw HTML blocks and inline HTML pass through the renderer unchanged. This is useful for one-off formatting needs that Markdown does not cover.

<!-- pagebreak -->
