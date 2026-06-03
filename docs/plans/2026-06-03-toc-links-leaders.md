---
status: complete
phase: 6
updated: 2026-06-03
---

# Implementation Plan: Hyperlinked TOC with Dotted Leaders

## Goal

Render the table of contents as hyperlinked anchor rows that span full width with leaders between heading text and page numbers, using renderer-owned fallback CSS so the feature works across all themes while remaining fully customizable via theme CSS.

## Context & Decisions

| Decision | Rationale | Source |
|---|---|---|
| Use `markdown-it-anchor` for heading ids | Battle-tested, handles slugification and duplicate-id disambiguation automatically. | `ref:https://github.com/valeriangalliat/markdown-it-anchor`, `ref:./src/renderer/markdown.js` |
| Renderer provides minimal fallback TOC layout CSS | Ensures hyperlinked TOC rows work across all themes, including custom/third-party themes, without requiring every theme to add TOC-specific rules. Themes may override for visual customization. | `ref:./src/html/template.js`, `ref:./README.md:117-120` |
| Renderer guarantees stable TOC class contract | `.toc-list`, `.toc-entry`, `.toc-level-N`, `.toc-link`, `.toc-text`, `.toc-leader`, `.toc-page-num` are always present. Themes can target these classes safely. | Design decision |
| Themes own final visual styling of TOC rows | Leader appearance, hover states, indentation, spacing, and typography are theme concerns. The renderer only ensures rows are clickable and structurally sound. | Design decision |
| Escape heading text in TOC markup | Headings may contain characters like `<` or `&` that would break raw HTML string concatenation. Escaping ensures TOC is always well-formed. | `ref:./src/html/template.js:130-138` |
| Nested list structure preserved | Current `h1`/`h2`/`h3` nesting into `<ul><li>` trees remains. Each nested entry gets the same anchor + leader treatment plus a `.toc-level-N` class. | `ref:./src/html/template.js:108-145` |
| Normal `<a href="#id">` anchors work in both HTML and PDF | Chromium/Puppeteer preserves internal anchor links in PDF output. No special PDF link logic needed. | `ref:https://pptr.dev/` |

## Stable TOC Class Contract

The renderer guarantees these classes on every generated TOC:

| Class | Element | Purpose |
|---|---|---|
| `.toc-list` | `<ul>` | Root and nested TOC lists |
| `.toc-entry` | `<li>` | Each TOC row |
| `.toc-level-1` | `<li>` | Top-level heading entry |
| `.toc-level-2` | `<li>` | Second-level heading entry |
| `.toc-level-3` | `<li>` | Third-level heading entry |
| `.toc-link` | `<a>` | Full-width clickable anchor wrapping the row |
| `.toc-text` | `<span>` | Heading title text |
| `.toc-leader` | `<span>` | Flexible spacer for dotted leader (aria-hidden) |
| `.toc-page-num` | `<span>` | Page number (omitted when numbering is hidden) |

## Phase 1: Heading IDs [PENDING]

- [ ] **1.1 Install `markdown-it-anchor`** ← CURRENT
  - `npm install markdown-it-anchor`
- [ ] 1.2 Configure the plugin in `src/renderer/markdown.js`
  - Add `import anchorPlugin from 'markdown-it-anchor'` and `md.use(anchorPlugin)`
  - Place after `markdown-it-attrs` so explicit `{#id}` attributes take precedence over generated slugs
- [ ] 1.3 Verify headings in rendered HTML have stable `id` attributes

## Phase 2: TOC Markup Update [PENDING]

- [ ] 2.1 Update the TOC script in `src/html/template.js` to emit anchor-based rows
  - Target markup per entry:
    ```html
    <li class="toc-entry toc-level-1">
      <a href="#heading-id" class="toc-link">
        <span class="toc-text">Chapter 1</span>
        <span class="toc-leader" aria-hidden="true"></span>
        <span class="toc-page-num">12</span>
      </a>
    </li>
    ```
- [ ] 2.2 Add `.toc-entry` and `.toc-level-N` classes based on heading level
- [ ] 2.3 Escape heading text before inserting into HTML to prevent malformed markup
  - Use `escapeHtml(text)` or switch to DOM-node construction for TOC items
- [ ] 2.4 Keep nested list tree structure unchanged (`h1` at root, `h2`/`h3` nested)
- [ ] 2.5 Keep TOC exclusion logic unchanged
- [ ] 2.6 Handle items with no page number gracefully — omit `.toc-page-num` when `pageNumber` is empty

## Phase 3: Renderer Fallback TOC CSS [PENDING]

- [ ] 3.1 Add minimal structural TOC CSS to renderer output
  - Inject alongside or inside the existing page chrome CSS in `src/html/page-chrome.js`
  - CSS provides layout guarantees only, not strong visual styling:
    ```css
    .toc-link {
      display: flex;
      align-items: baseline;
      width: 100%;
      color: inherit;
      text-decoration: none;
    }
    .toc-text {
      white-space: nowrap;
      flex-shrink: 0;
    }
    .toc-leader {
      flex: 1;
      margin: 0 0.4em;
      border-bottom: 1px dotted currentColor;
      transform: translateY(-0.15em);
    }
    .toc-page-num {
      white-space: nowrap;
      flex-shrink: 0;
    }
    ```
- [ ] 3.2 This CSS is always injected regardless of theme — themes never need to add their own TOC layout rules unless they want to customize appearance
- [ ] 3.3 Themes may override `.toc-leader`, `.toc-link`, `.toc-page-num`, etc. for their own visual style

## Phase 4: Theme CSS (Optional Override) [PENDING]

- [ ] 4.1 Update `themes/default/styles.css` — add optional hover/focus styles for `.toc-link`, keep existing `.toc-list` nesting rules
- [ ] 4.2 Update `samples/sample-book/themes/demo/styles.css` — same optional overrides
- [ ] 4.3 These are purely cosmetic; the renderer fallback CSS already provides full functional layout

## Phase 5: Tests [PENDING]

- [ ] 5.1 Add heading-id test in `test/markdown.test.js`
  - `h1` has `id` attribute after rendering
  - duplicate heading text gets different ids
- [ ] 5.2 Add TOC fallback CSS test
  - Renderer output contains `.toc-link { display: flex; width: 100%; ... }` rules
- [ ] 5.3 Add TOC markup tests
  - Generated TOC contains `href="#..."` on `.toc-link` elements
  - `.toc-leader` element is present on every entry with a page number
  - `.toc-entry`, `.toc-level-N` classes present
- [ ] 5.4 Add heading escaping test
  - Heading text with `<` or `&` does not produce malformed HTML in TOC
- [ ] 5.5 Keep existing TOC exclusion test working
- [ ] 5.6 Add hidden-numbering test — TOC rows still rendered when numbering is `none`, just without `.toc-page-num`

## Phase 6: Verification [PENDING]

- [ ] 6.1 Run `node --test test/**/*.test.js` — all tests pass
- [ ] 6.2 Build `samples/sample-book` — open HTML, click TOC links, verify they jump to correct headings
- [ ] 6.3 Serve `samples/sample-book` — same link verification in live preview
- [ ] 6.4 Build PDF — open in a PDF viewer, verify TOC links are preserved as internal anchors
- [ ] 6.5 Verify leaders appear correctly via renderer fallback CSS in both HTML and PDF
- [ ] 6.6 Verify TOC rows occupy full page width

## Files Changed Summary

| File | Change |
|---|---|
| `src/renderer/markdown.js` | Add `markdown-it-anchor` plugin |
| `src/html/template.js` | Update TOC script: anchor rows, stable classes, heading escaping |
| `src/html/page-chrome.js` | Add renderer fallback TOC CSS |
| `themes/default/styles.css` | Add optional TOC hover/focus overrides |
| `samples/sample-book/themes/demo/styles.css` | Add optional TOC hover/focus overrides |
| `test/markdown.test.js` | Add heading-id tests |
| `test/toc-links.test.js` | **New** — TOC markup, fallback CSS, and escaping tests |
| `package.json` | Add `markdown-it-anchor` dependency |

## Notes

- 2026-06-03: Renderer fallback CSS means custom/third-party themes work without modification. Themes only need to add CSS if they want to customize TOC appearance.
- 2026-06-03: The stable class contract (`.toc-entry`, `.toc-level-N`, `.toc-link`, `.toc-text`, `.toc-leader`, `.toc-page-num`) is the interface between renderer and themes. Themes should never depend on specific DOM structure beyond these classes.
- 2026-06-03: Leaders default to dotted via `border-bottom` on `.toc-leader`. Themes can override to dashed, solid, hidden, or any other style.
- 2026-06-03: Heading text is escaped before insertion into TOC markup to prevent malformed HTML from headings containing `<`, `>`, or `&` characters.
- 2026-06-03: Implemented. 81 tests passing. `markdown-it-anchor` provides automatic heading ids. TOC script emits `.toc-entry`, `.toc-level-N`, `.toc-link`, `.toc-text`, `.toc-leader`, `.toc-page-num` classes with escaped text. Renderer fallback CSS injected via `page-chrome.js`. Theme CSS updated with optional overrides. Sample-book builds clean with 14 heading ids and fallback TOC layout CSS in output.
