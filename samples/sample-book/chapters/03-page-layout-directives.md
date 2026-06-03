<!-- layout:singlecol -->

# Chapter 3: Page Layout Directives

This chapter covers the directives that control page structure: page breaks, column layout, and column breaks.

## Page Break

Starts a new page. Content after this directive begins on a fresh page.

Syntax:

```md
<!-- pagebreak -->
```

se `pagebreak` between chapters, before major sections, or anywhere you want a clean page boundary. The directive also auto-closes any open container wrappers.

<!-- layout:singlecol -->

## Single Column Pages

Switches the page layout to a single column.

Syntax:

```md
<!-- layout:singlecol -->
```

Use single-column layout for:

- Chapter opening pages
- Wide tables or code blocks
- Full-width images
- Appendix material
- Any content that needs the full page width

<!-- pagebreak -->

<!-- layout:twocol -->

## Two Columns Pages

Switches the page layout to two columns. This is the default layout.

Syntax:

```md
<!-- layout:twocol -->
```

Two-column layout is ideal for body text in books, as shorter line lengths improve readability.

## `columnbreak`

Forces content into the next column within a two-column page. In single-column layout, this directive is ignored.

Syntax:

```md
<!-- columnbreak -->
```

<!-- columnbreak -->

This text was pushed to the second column by the `columnbreak` directive above it. Use `columnbreak` to balance columns or to start a new section in the right column. The next text will flow normally.

## Persistence Rule

All page directives -- `layout`, `page-number`, and `header` -- persist across `pagebreak` boundaries until explicitly changed. Once you set a layout, every subsequent page keeps that layout until you issue a new layout directive.

<!-- pagebreak -->
