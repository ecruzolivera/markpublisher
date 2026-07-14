<!-- layout:twocol -->

# Chapter 4: Navigation and Page Chrome

This chapter covers the table of contents, TOC exclusion, page numbering, and running headers.

## `toc:pages=N`

Inserts an automatically generated table of contents based on all headings in the book. The `pages=N` argument reserves N TOC pages. For most books, `N=1` is sufficient. For books with many headings, use a larger number so the TOC can span multiple pages.

Syntax:

```md
<!-- toc:pages=1 -->
<!-- toc:pages=2 -->
```

The TOC collects every `h1`, `h2`, and `h3` from every page, links them to their heading anchors, and shows page numbers alongside each entry. It is rendered on the page where the `<!-- toc:pages=N -->` directive appears.

If the TOC content exceeds the reserved pages, a warning appears on the final TOC page. Increase `pages=N` to fix the overflow.

The `pages=N` argument is required — plain `<!-- toc -->` is not valid.

### Filtering heading levels

The optional `levels` argument limits which heading levels appear in the TOC. Values are `1`, `2`, or `3` (corresponding to `h1`, `h2`, `h3`). When omitted, all three levels are included.

Syntax:

```md
<!-- toc:pages=1 levels=1 -->       Only h1 headings
<!-- toc:pages=2 levels=1,2 -->     h1 and h2 headings
<!-- toc:pages=1 levels=2,3 -->     h2 and h3 headings, omit h1
```

Levels are comma-separated (spaces are allowed). Duplicate and out-of-range values are silently normalized. The heading hierarchy is preserved: if intermediate levels are skipped, children nest under the nearest retained level.

This tutorial's `book.md` places the TOC directive after the title page, before any chapter includes.

## `toc-exclude` and `/toc-exclude`

Exclude headings from the TOC. Wrap the headings you want to hide between these directives.

Syntax:

```md
<!-- toc-exclude -->

## Hidden Heading

This heading and any content here will not appear in the TOC.

<!-- /toc-exclude -->
```

<!-- pagebreak -->

<!-- toc-exclude -->

## Internal Notes Heading

This heading is excluded from the TOC. Use `toc-exclude` for scratch sections, internal notes, or anything that should not appear in the table of contents.

<!-- /toc-exclude -->

## Visible Heading

This heading appears in the TOC because it is outside the exclusion block. The `toc-exclude` effect is limited to the content between the start and end directives.

## `page-number:start=N`

Enables arabic page numbering starting at the given number. The counter increments automatically on each `pagebreak`.

Syntax:

```md
<!-- page-number:start=1 -->
```

Page numbering was already started in `book.md` after the TOC. It persists across every page break without repeating the directive. Set the start number once and all subsequent pages are numbered sequentially.

## `page-number:none`

Hides page numbers on the current page and all subsequent pages until re-enabled.

Syntax:

```md
<!-- page-number:none -->
```

Use this on title pages, copyright pages, or blank pages where numbers should be hidden. To restart numbering later, issue a new `page-number:start=N` directive.

<!-- pagebreak -->

## `header:show`

Enables running headers. The header displays the current chapter title at the top of each page.

Syntax:

```md
<!-- header:show -->
```

<!-- header:show -->

Headers pick up the nearest `h1` or `h2` heading above the page break. Once enabled, headers appear on every subsequent page.

## `header:hide`

Disables running headers.

Syntax:

```md
<!-- header:hide -->
```

Use this on pages where headers would be distracting, such as the table of contents or opening chapter spreads.

<!-- header:hide -->

Headers have been hidden on this page and will remain off until `header:show` is issued again. Like all page directives, header state persists across `pagebreak` boundaries.

<!-- pagebreak -->
