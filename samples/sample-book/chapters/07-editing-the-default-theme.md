<!-- layout:singlecol -->

# Chapter 7: Editing the Default Theme

MarkPublisher's visual design comes from a single file: `themes/default/theme.css`. This chapter walks through every section of that file and shows what happens when you edit each part.

Open `themes/default/theme.css` in your editor alongside this chapter. Every example references real CSS that is already active in this document.

## Page Size

The `@page` rule sets the paper dimensions for PDF output:

```css
@page {
  size: A4;
  margin: 0;
}
```

Change `A4` to `A5`, `Letter`, or `Legal` to adjust paper size. The `.page` class below must match these dimensions.

## Page Box

The `.page` class defines the physical page on screen and in print:

```css
.page {
  width: 210mm;
  height: 297mm;
  padding: 18mm 14mm 24mm 14mm;
  position: relative;
  overflow: hidden;
  page-break-after: always;
  background: white;
}
```

What to change:

- `width` and `height`: match these to your `@page` size
- `padding`: controls margins inside the page. `18mm 14mm 24mm 14mm` means top 18mm, right 14mm, bottom 24mm, left 14mm. The larger bottom margin leaves room for page numbers
- `background`: the page fill color. Each page is drawn as a white rectangle over a subtle gray background

<!-- pagebreak -->

## Column Layout

These classes control single and two-column layouts:

```css
.page.twocol {
  column-count: 2;
  column-gap: 7mm;
  column-fill: auto;
}

.page.singlecol {
  column-count: 1;
}
```

What to change:

- `column-gap`: space between columns. Try `5mm` for tighter text, `10mm` for more breathing room
- `column-fill`: `auto` fills columns unevenly; `balance` tries to equalize column heights

## Column Breaks

```css
.column-break {
  break-after: column;
}
```

This rule is used by the `<!-- columnbreak -->` directive. The `break-after: column` property forces content into the next column.

## Full-Width Elements

```css
.wide {
  column-span: all;
}
```

The `wide` class, applied via `<!-- apply-next:.wide -->`, makes an element span both columns. This is used for headings, images, or tables that need the full page width.

<!-- pagebreak -->

## Base Typography

```css
body {
  margin: 0;
  padding: 0;
  font-family: "EB Garamond", sans-serif;
  font-size: 11pt;
  line-height: 1.6;
  color: #1f2733;
  background: #f2f5f8;
}
```

What to change:

- `font-family`: the body text typeface. The default imports EB Garamond from Google Fonts. Replace with any serif font for body text
- `font-size`: text size. Common book sizes range from 10pt to 12pt
- `line-height`: leading between lines. `1.6` is comfortable for 11pt body text
- `color`: text color
- `background`: the background behind the pages (not inside them)

<!-- pagebreak -->

## Heading Typography

```css
h1,
h2,
h3 {
  font-family: "Noto Sans", sans-serif;
  font-weight: 700;
}

h1 {
  font-size: 20pt;
  margin-top: 0;
  margin-bottom: 0.5em;
  column-span: all;
}

h2 {
  font-size: 15pt;
  margin-top: 0.9em;
  margin-bottom: 0.4em;
}
```

What to change:

- `font-family`: the heading typeface. The default uses Noto Sans for contrast against the serif body
- `font-size`: heading sizes. `h1` is 20pt (chapter titles), `h2` is 15pt (section headings)
- `column-span: all` on `h1` ensures chapter titles always span both columns

<!-- pagebreak -->

Running headers sit at the top of every page:

```css
.running-header {
  position: absolute;
  top: 8mm;
  left: 14mm;
  right: 14mm;
  font-size: 9pt;
  color: #6a7d94;
  text-align: center;
}

.page-number {
  position: absolute;
  bottom: 9mm;
  left: 0;
  right: 0;
  text-align: center;
  font-size: 9pt;
  color: #6a7d94;
}

.page-number::after {
  content: attr(data-page-number);
}
```

What to change:

- `top` and `bottom`: position of headers and page numbers relative to page edges
- `font-size`: usually smaller than body text (8-10pt)
- `color`: subtle color for running text that should not compete with body content
- `text-align`: use `left`/`right` for facing-page headers, `center` for single-sided

<!-- pagebreak -->

## Callout Containers

The `note` container, triggered by `<!-- note --> ... <!-- /note -->`:

```css
.note {
  background: #eef4ff;
  border-left: 4px solid #5373a1;
  padding: 0.8em;
  margin: 1em 0;
  break-inside: avoid;
}
```

What to change:

- `background`: the fill color. Try warmer tones for warnings, cooler for tips
- `border-left`: the accent bar. Change width to be bolder, color to match your palette
- `padding`: space inside the callout
- `break-inside: avoid`: prevents the callout from splitting across columns or pages

To create additional callout variants, add new CSS rules and use them with container directives. For example, to create a warning callout:

```css
.warning {
  background: #fff4e6;
  border-left: 4px solid #d97706;
  padding: 0.8em;
  margin: 1em 0;
  break-inside: avoid;
}
```

Then use:

```md
<!-- warning -->

This is a warning callout.

<!-- /warning -->
```

<!-- pagebreak -->

Extra classes on containers also work:

```md
<!-- tip .callout-box #unique-id -->

Custom tip content.

<!-- /tip -->
```

The container gets `class="tip callout-box"` and `id="unique-id"`, allowing you to style it with any combination of classes.

## Images and Tables

```css
img {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 1em auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  margin: 1em 0;
  font-size: 0.9em;
}

th,
td {
  border: 1px solid #c8d1db;
  padding: 0.4em;
  text-align: left;
}
```

What to change:

- `img` margins: center images with `auto`, or left-align with `margin: 1em 0`
- `table` font size: `0.9em` makes tables slightly smaller than body text
- `th, td` border color: match to your color palette
- `th, td` padding: increase for larger cells, decrease for compact tables

<!-- pagebreak -->

## TOC Styling

```css
.toc-list {
  list-style: none;
  padding: 0;
}

.toc-entry {
  margin-bottom: 0.25em;
}

.toc-page-num {
  color: #6a7d94;
}

.toc-link:hover {
  text-decoration: underline;
}
```

What to change:

- `.toc-entry` `margin-bottom`: vertical spacing between TOC entries
- `.toc-page-num` `color`: matches the page number color for consistency
- Add font size or weight to differentiate chapter entries from section entries

## Fonts

The default theme imports fonts from Google Fonts at the top of the file:

```css
@import url("https://fonts.googleapis.com/...");
```

This is convenient for development but means the output depends on network availability. For fully offline builds, download font files into a `fonts/` directory inside your theme and use `@font-face` rules instead.

<!-- pagebreak -->

## Quick Reference: What Controls What

| Visual Element      | CSS Selector                            |
| ------------------- | --------------------------------------- |
| Paper size          | `@page { size: ... }`                   |
| Page dimensions     | `.page { width; height }`               |
| Page margins        | `.page { padding }`                     |
| Body text           | `body { font-family; font-size }`       |
| Headings            | `h1, h2, h3 { ... }`                    |
| Running headers     | `.running-header`                       |
| Page numbers        | `.page-number`                          |
| Two-column gap      | `.page.twocol { column-gap }`           |
| Full-width elements | `.wide { column-span: all }`            |
| Column breaks       | `.column-break { break-after: column }` |
| Callout boxes       | `.note { background; border }`          |
| Images              | `img { max-width }`                     |
| Tables              | `table, th, td { ... }`                 |
| Table of contents   | `.toc-list, .toc-entry, .toc-page-num`  |

<!-- pagebreak -->
