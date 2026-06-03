# MarkPublisher Tutorial

The official MarkPublisher tutorial project. This sample book demonstrates every v1 feature through progressive chapters that build on each other.

## Run

From this directory:

```bash
cd samples/sample-book
markpublisher serve
```

## Expected Output

- `output/output.html` -- standalone HTML with pagination toolbar and bundled assets
- `output/output.pdf` -- print-ready PDF

## Chapters

| Chapter | What You'll Learn |
| --- | --- |
| 1. Getting Started | Project structure, `markpublisher.toml`, `serve` vs `build` |
| 2. Writing with Markdown | Front matter, wikilink includes, partials, image references |
| 3. Page Layout Directives | `pagebreak`, `layout:twocol`, `layout:singlecol`, `columnbreak` |
| 4. Navigation & Page Chrome | `toc`, `toc-exclude`, page numbering, running headers |
| 5. Content Styling Directives | `image:`, `table:`, `apply-next:`, container wrappers |
| 6. Markdown Extras | Footnotes, definition lists, abbreviations, sub/sup |
| 7. Editing the Default Theme | Practical guide to customizing `theme.css` |
| 8. Reference Appendix | Directive cheat sheet, theme CSS reference, file layout |

## Features Demonstrated

Every directive supported by MarkPublisher v1:

- `pagebreak`, `layout:twocol`, `layout:singlecol`
- `columnbreak`
- `page-number:start=N`, `page-number:none`
- `header:show`, `header:hide`
- `toc`, `toc-exclude`, `/toc-exclude`
- `image:`, `table:`, `apply-next:`
- Container wrappers with classes and ids
- Wikilink includes, wikilink images
- Footnotes, definition lists, abbreviations, sub/sup
- Theme CSS editing with `theme.css`
