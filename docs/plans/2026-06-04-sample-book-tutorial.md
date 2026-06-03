---
status: not-started
phase: 2
updated: 2026-06-04
---

# Implementation Plan: Sample Book Tutorial Rewrite

## Goal

Rewrite `samples/sample-book/` as a progressive MarkPublisher tutorial where each chapter teaches a focused set of features through working examples that render correctly in both `serve` and `build`.

## Context & Decisions

| Decision | Rationale | Source |
|---|---|---|
| Phase 1 bug fixes are complete | `resolveProjectImage` (three-tier image resolution), `image:` directive HTML comment guard, and wikilink image rendering (`![[image.svg]]`) are all working. Tutorial content can now use clean project-root image paths and wikilink images. | `ref:./src/paths/resolver.js`, `ref:./src/renderer/index.js`, `ref:./src/renderer/preprocessor.js` |
| Tutorial uses 4 chapters matching existing `book.md` includes | Keeps `book.md` unchanged structurally, avoids renumbering includes, ensures the project builds at every step. | `ref:./samples/sample-book/book.md` |
| Each chapter starts with an intro paragraph and teaches by showing | Readers should understand what they'll learn before seeing examples. Directives are shown inline with the content they affect, not in abstract tables. | Design decision |
| Partials remain reusable assets in `partials/` | `callout.md` and `glossary.md` are referenced by the tutorial and demonstrate real-world snippet reuse. Their content stays unchanged. | `ref:./samples/sample-book/partials/` |
| Every directive used must render correctly | No broken examples, no "Unknown directive" warnings, no missing images. The tutorial is self-verifying — if it builds clean, it's correct. | Design decision |

## Phase 1: Bug Fixes [COMPLETE]

- [x] 1.1 `resolveProjectImage` — three-tier image resolution (absolute → project-root → source-file-relative)
- [x] 1.2 `image:` directive guard — skip HTML comment lines
- [x] 1.3 Wikilink image rendering — `![[image.svg]]` emits markdown image syntax
- [x] 1.4 Image paths cleaned up in chapter files
- [x] 1.5 Tests pass (80), build clean (1 pre-existing warning)

## Phase 2: Tutorial — Cover, Structure & README [PENDING]

- [ ] **2.1 Update `book.md` front matter and title** ← CURRENT
  - Title: `MarkPublisher Tutorial`
  - Author: keep `Demo Author`
  - Subtitle heading: `# MarkPublisher Tutorial`
  - Intro paragraph: 2-3 sentences about what this tutorial covers
  - Keep: TOC, `<!-- pagebreak -->`, all four `![[chapters/...]]` includes
- [ ] 2.2 Update `samples/sample-book/README.md`
  - Describe this as the official tutorial project
  - Explain how to run: `cd samples/sample-book && markpublisher serve`
  - List what each chapter teaches (chapters index)
  - Remove the "Project-local custom theme resolution" line (theme is now `default` not `demo`)

## Phase 3: Tutorial — Chapter 1: Getting Started [PENDING]

File: `samples/sample-book/chapters/01-getting-started.md`

- [ ] 3.1 Remove `<!-- header:show -->` (keep intro clean, no running header)
- [ ] 3.2 Keep `layout:singlecol` (wider text for reading)
- [ ] 3.3 Keep `page-number:start=1` so page numbers start here
- [ ] 3.4 Rewrite into sections:
  - **Installation** — npm install, init, serve (keep current)
  - **Project Structure** — explain `book.md`, `chapters/`, `partials/`, `images/`, `themes/`, `markpublisher.toml`
  - **Your First Directives** — explain directive concept, show abbreviations, sub/sup, note container
  - **Reusable Partials** — `![[partials/callout]]` included twice to show reuse
- [ ] 3.5 Move the existing deflist + footnotes to Chapter 4 (they don't fit "Getting Started")
- [ ] 3.6 Add `<!-- layout:twocol -->` before the final `<!-- pagebreak -->` to reset layout state. Without this, Chapter 2 inherits the `singlecol` state from the cover and Chapter 1, which would silently break the two-column examples in Chapter 2. Layout state persists across pagebreaks until changed.
- [ ] 3.7 End with `<!-- pagebreak -->`

## Phase 4: Tutorial — Chapter 2: Layout & Images [PENDING]

File: `samples/sample-book/chapters/02-layouts.md`

- [ ] 4.1 Chapter 2 starts in `twocol` layout (reset by Chapter 1's `<!-- layout:twocol -->`)
- [ ] 4.2 Rewrite into sections:
  - **Full-Width Headings** — `<!-- apply-next:.wide #hero -->` on a heading
  - **Image Styling** — `<!-- image: ... -->` on `![[images/cover.svg]]` (wikilink image), then plain markdown `![Plain diagram](images/diagram.svg)` to show one-shot behavior
  - **Column Breaks** — `<!-- columnbreak -->` in two-column layout
  - **Single Column Pages** — `<!-- layout:singlecol -->` interlude with spread image, then back to `twocol`
- [ ] 4.3 Keep wikilink image `![[images/cover.svg]]` with `image:` directive
- [ ] 4.4 Keep plain markdown image `![Plain diagram](images/diagram.svg)`
- [ ] 4.5 Keep columnbreak + singlecol interlude with `![Spread illustration](images/spread.svg)`

## Phase 5: Tutorial — Chapter 3: Page Controls [PENDING]

File: `samples/sample-book/chapters/03-advanced.md`

- [ ] 5.1 Rewrite into sections:
  - **Page Numbering** — `<!-- page-number:start=5 -->` enables numbers, state persists
  - **Table Column Widths** — `<!-- table: 25%, 50%, 25% -->` on a features table
  - **Running Headers** — `<!-- header:show -->` / `<!-- header:hide -->` toggles
  - **TOC Exclusion** — `<!-- toc-exclude -->` block to hide internal headings
- [ ] 5.2 Keep `header:show` at the top, `page-number:start=5`, table widths, toc-exclude block
- [ ] 5.3 End with `header:hide` and `page-number:none`

## Phase 6: Tutorial — Chapter 4: Finishing Your Book [PENDING]

File: `samples/sample-book/chapters/04-appendix.md`

- [ ] 6.1 Rewrite into sections:
  - **Footnotes** — `[^1]` syntax with multi-paragraph example
  - **Definition Lists** — terms and definitions (moved from Chapter 1)
  - **Glossary** — `![[partials/glossary]]` include
  - **Building Your Book** — explain `markpublisher build` output: HTML, PDF, assets/
  - **Next Steps** — links to README, theme creation, directive reference
- [ ] 6.2 Add a footnote example (`[^fn]` with multi-paragraph)
- [ ] 6.3 Move deflist content from Chapter 1 here
- [ ] 6.4 Keep `![[partials/glossary]]` include
- [ ] 6.5 Add "Building Your Book" and "Next Steps" sections
- [ ] 6.6 Keep `<!-- layout:singlecol -->` for readability

## Phase 7: Verification [PENDING]

- [ ] 7.1 Run `node --test test/**/*.test.js` — all tests pass
- [ ] 7.2 Build `samples/sample-book` — zero new warnings
- [ ] 7.3 Serve `samples/sample-book` — toolbar visible, TOC links work, all images display
- [ ] 7.4 Build PDF — images render, no alt-text fallback
- [ ] 7.5 Verify TOC entries match chapter headings (all 4 chapters + sub-headings)
- [ ] 7.6 `markpublisher init /tmp/test-tutorial` builds clean from the new tutorial template

## Files Changed Summary

| File | Change |
|---|---|
| `samples/sample-book/book.md` | Title → MarkPublisher Tutorial, updated intro |
| `samples/sample-book/README.md` | Rewrite for tutorial purpose |
| `samples/sample-book/chapters/01-getting-started.md` | Full rewrite — install, structure, first directives, partials |
| `samples/sample-book/chapters/02-layouts.md` | Full rewrite — layout, apply-next, wikilink image, image directive, columnbreak |
| `samples/sample-book/chapters/03-advanced.md` | Full rewrite — page numbering, headers, table widths, toc-exclude |
| `samples/sample-book/chapters/04-appendix.md` | Full rewrite — footnotes, deflist, glossary, building, next steps |
| `samples/sample-book/partials/callout.md` | No change |
| `samples/sample-book/partials/glossary.md` | No change |

## Notes

- 2026-06-04: Phase 1 bug fixes (image resolution, `image:` directive guard, wikilink images) are complete. The tutorial can now use clean project-root image paths (`images/cover.svg`) and wikilink images (`![[images/cover.svg]]`) throughout.
- 2026-06-04: Content migrated between chapters: footnotes and definition lists move from Chapter 1 to Chapter 4. Chapter 1 focuses on "Getting Started" (install, structure, first directives, partials). Chapter 4 becomes "Finishing Your Book" with all the details.
- 2026-06-04: The `partials/` content (callout.md, glossary.md) is unchanged. They serve as working examples of reusable content.
- 2026-06-04: Every directive shown in the tutorial must produce output visible in `serve`. There are no abstract examples — the reader sees the result immediately.
- 2026-06-04 (review fix): Added explicit `<!-- layout:twocol -->` at the end of Chapter 1 so Chapter 2 starts in two-column layout. Layout state persists across `pagebreak` boundaries — without this, the `columnbreak` and `apply-next` demos in Chapter 2 would silently break (columnbreak ignored with warning, full-width heading not visible in singlecol).
