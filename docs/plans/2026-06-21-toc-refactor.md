# TOC Refactor Plan

## Problem

The current TOC logic in `src/html/toc-script.js` mixes four concerns in one script:

1. Reading config from placeholders
2. Collecting headings from the document
3. Building a nested heading tree
4. Rendering and paginating into physical TOC pages

Pagination uses `rootIdx` + `childStart` to track state, which only handles two nesting levels. Adding h3 support required a recursive `createDescendantEntry` patch. Future changes (e.g., `levels=2,3` with no h1, or `levels=4`) would need more patches.

## Goal

Refactor TOC generation into a clear pipeline:

```
placeholder config
→ collect headings
→ normalize/filter headings
→ build tree
→ flatten render units
→ paginate render units
→ render pages
```

## Phase 1: Define TOC Semantics

### Supported levels

Keep current preprocessor validation: only `1,2,3`. The preprocessor at `src/renderer/preprocessor.js:313` already enforces this.

### Default levels

Keep current default: `1,2,3`. The script at `src/html/toc-script.js:13-17` sets this when no `data-toc-levels` attribute is present.

### Visual level behavior

- **Current**: Root entries are always rendered as `toc-level-1`, even when the first allowed level is h2. The `createEntryLine(rootItem, 1)` call hardcodes level 1.
- **Change**: Preserve real heading levels in the class names. If `levels=2,3`, h2 entries render as `toc-level-2`, h3 as `toc-level-3`.

### Visual indentation behavior

Preserving the real class names does not require preserving literal left margin by heading number.

Recommended visual rule:

- `levels=1,2,3`: h1 flush-left, h2 indented one step, h3 indented two steps
- `levels=2,3`: h2 flush-left, h3 indented one step
- `levels=3`: h3 flush-left

Implementation rule: compute indentation relative to the **first included level**, while keeping the real `toc-level-N` classes in the DOM.

### Pagination granularity

- **Current**: Paginates at h2-subtree level. If an h2 fits but its h3 children don't, the entire h2 subtree moves to the next page.
- **Change**: Paginate at the individual entry level. Each TOC line is a flat entry. If an entry doesn't fit, only that entry moves to the next page.

## Phase 2: Flatten the Tree

Replace the nested pagination state:

```js
var rootIdx = 0;
var childStart = 0;
```

With a flat list of renderable entries:

```js
// Each entry knows its item and real heading level
{ item: headingItem, level: 2 }
```

### Flattening algorithm

Walk the tree in document order, producing a flat array:

```js
function flattenTree(items) {
  var flat = [];
  for (var i = 0; i < items.length; i++) {
    flat.push({ item: items[i], level: items[i].level });
    if (items[i].children && items[i].children.length > 0) {
      var children = flattenTree(items[i].children);
      flat = flat.concat(children);
    }
  }
  return flat;
}
```

## Phase 3: Replace Nested Pagination with Flat Pagination

### Current approach

```
Render h1
  Render h2 children (tracked by childStart)
    h3 rendered recursively inside h2
```

### New approach

```
For each flat TOC entry:
  append entry to current TOC page
  measure if it fits
  if not:
    remove it
    move to next TOC page
    retry same entry
```

### Pagination loop

```js
var entryIdx = 0;
var pageIdx = 0;

while (entryIdx < entries.length && pageIdx < placeholders.length) {
  var placeholder = placeholders[pageIdx];
  var list = createList(placeholder);
  var maxBottom = availableBottom(placeholder);

  while (entryIdx < entries.length) {
    var entry = entries[entryIdx];
    var li = createEntry(entry);
    list.appendChild(li);

    if (!entryFits(placeholder, maxBottom, li)) {
      list.removeChild(li);
      pageIdx++;
      break; // retry same entry on next page
    }

    entryIdx++;
  }
}
```

Key property: entries are never skipped. If an entry doesn't fit, it retries on the next page.

## Phase 4: Add Visual Hierarchy with CSS, Not Nested DOM

### Current approach

Physical DOM nesting using `<ul>` inside `<li>`:

```html
<li class="toc-level-1">
  h1
  <ul>
    <li class="toc-level-2">
      h2
      <ul>
        <li class="toc-level-3">h3</li>
      </ul>
    </li>
  </ul>
</li>
```

### New approach

Flat DOM entries with CSS classes for indentation:

```html
<li class="toc-entry toc-level-1">h1</li>
<li class="toc-entry toc-level-2">h2</li>
<li class="toc-entry toc-level-3">h3</li>
<li class="toc-entry toc-level-2">h2</li>
<li class="toc-entry toc-level-1">h1</li>
```

### Required CSS changes

The renderer fallback CSS in `src/html/page-chrome.js` and the bundled sample themes all need indentation rules for flat entries.

Because the class names remain semantic (`toc-level-1`, `toc-level-2`, `toc-level-3`), indentation should be computed relative to the first allowed level.

Example approach:

```css
.toc-entry {
  margin-left: calc(var(--toc-indent-step, 1.5em) * var(--toc-indent, 0));
}
```

And per entry, set an inline custom property based on `entry.level - firstIncludedLevel`:

```js
li.style.setProperty("--toc-indent", String(entry.level - firstIncludedLevel));
```

This removes the need for nested lists entirely, makes pagination trivial, and avoids indenting h2 entries when `levels=2,3`.

## Phase 5: Visual Level Preservation

### Current behavior

```js
var parentLi = createEntryLine(rootItem, 1); // hardcoded level 1
```

All root entries (regardless of real heading level) get `toc-level-1`.

### Fix

Remove the hardcoded level override. Each entry uses its real level for class naming:

```js
function createEntry(flatEntry) {
  return createEntryLine(flatEntry.item, flatEntry.level);
}
```

For `levels=2,3`, h2 entries render as `toc-level-2`, h3 as `toc-level-3`. For `levels=1,2,3`, h1 renders as `toc-level-1`, etc.

### Tree root handling

When `levels=2,3` (no h1), the tree still has a virtual root `{ level: 0 }`. The `stack[0].children` contains only h2 items. Their flattened entries should keep `level: 2`, matching their real heading level, while their visual indentation is normalized from the first included level.

## Phase 6: Split Functions

Reorganize `src/html/toc-script.js` into named functions:

```
readTocConfig(placeholders)    → { allowedLevels: {} }
collectHeadings(root, config)  → [{ level, text, pageNumber, id }]
buildHeadingTree(headings)     → [{ level, children: [...] }]
flattenTree(items)             → [{ item, level }]
createEntry(flatEntry)         → <li>
createList(placeholder)        → <ul>
contentBoxBottom(page)         → number
availableBottom(placeholder)   → number
entryFits(maxBottom, li)       → boolean
paginate(entries, placeholders) → void
ensureEmptyLists(placeholders) → void
renderOverflowWarning(placeholders) → void
```

`collectHeadings()` must preserve the existing `TOC_EXCLUDE_START` / `TOC_EXCLUDE_END` behavior via the current `excludeDepth` tracking.

Most of these are pure-ish and would be testable.

## Phase 7: Remove Dead Code

After the refactor, remove:

- `createDescendantEntry` (recursive DOM nesting — replaced by flat entries)
- `attachChildList` (nested `<ul>` creation — replaced by CSS indentation)
- `rootIdx` and `childStart` (state variables — replaced by `entryIdx` and `pageIdx`)
- `placedOnPage` flag (complex branching — replaced by simple retry loop)

## Phase 8: Tests

### Existing tests

- Preprocessor tests for `toc:pages=N levels=...` stay unchanged.
- E2E test for `data-toc-levels` stays unchanged.

### New tests to add (Node, string-based)

Verify the generated `toc-script.js` in the HTML output contains:

- `toc-level-2` class usage
- `toc-level-3` class usage
- No obsolete `childStart` pattern
- Flat entry iteration with `entryIdx`
- Indentation normalization based on the first included level
- Preserved `TOC_EXCLUDE_START` / `TOC_EXCLUDE_END` logic

These can be added to `test/e2e.test.js` or a new `test/toc-script.test.js`.

### Future (optional)

DOM-based tests using a headless browser could verify actual TOC rendering, but this requires new dependencies. Skip for now.

## Files Changed

| File                                                      | Change                                                                                |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `src/html/toc-script.js`                                  | Full rewrite of rendering/pagination logic; keep heading collection and tree building |
| `src/html/page-chrome.js`                                 | Add fallback indentation support for flat TOC entries                                 |
| `samples/sample-book/themes/default/theme.css`            | Add TOC indentation rules for flat entries                                            |
| `samples/La Sombra del Calabozo/themes/default/theme.css` | Add TOC indentation rules for flat entries                                            |
| `samples/La Sombra del Calabozo/themes/sombra/theme.css`  | Add TOC indentation rules for flat entries                                            |
| `test/e2e.test.js`                                        | Add string-based assertions for flat TOC rendering                                    |

## Migration Strategy

The earlier TOC plan in `docs/plans/2026-06-03-toc-links-leaders.md` explicitly preserved nested DOM structure. This plan intentionally reverses that decision because flat entries make pagination simpler, more reliable, and easier to reason about. The stable TOC class contract (`.toc-list`, `.toc-entry`, `.toc-level-N`, `.toc-link`, `.toc-text`, `.toc-leader`, `.toc-page-num`) still protects themes from DOM-shape changes.

Do in one implementation pass to reduce churn:

1. **Flatten + paginate + normalize indentation**
   - Replace nested `<ul>` with flat `<li>` entries
   - Keep real `toc-level-N` classes
   - Compute indentation relative to the first included level
   - Replace `rootIdx`/`childStart` with `entryIdx`/`pageIdx`
   - Remove `createDescendantEntry`, `attachChildList`
   - Keep heading collection and tree building unchanged
   - Preserve `TOC_EXCLUDE_START` / `TOC_EXCLUDE_END`
   - Preserve empty placeholder cleanup

### Oversized entry behavior

Current behavior can silently skip an entry that does not fit on an empty TOC page.

New behavior should be:

- never silently skip an entry
- retry the same entry on the next TOC page
- if no TOC page can fit the entry, surface the existing overflow warning

## Verification

```bash
# Build sample book with levels=1,2,3
cd samples/sample-book && node ../../src/cli.js build

# Verify in output:
grep 'toc-level-3' output/output.html   # should find class usage in script
grep 'data-toc-levels="1,2,3"' output/output.html

# Run all tests
npm test
```
