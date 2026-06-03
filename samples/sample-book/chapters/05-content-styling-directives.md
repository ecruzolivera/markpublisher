<!-- layout:twocol -->

# Chapter 5: Content Styling Directives

This chapter covers directives that style specific content: images, tables, block attributes, and container wrappers.

## `image:`

Applies CSS styles to the next image only. After the next image is rendered, the styles are consumed and do not affect subsequent images.

Syntax:

```md
<!-- image: width: 50%; border: 2px solid #333; padding: 4px; -->
```

<!-- image: width: 50%; border: 2px solid #5373a1; padding: 4px; -->

![Styled cover image](images/cover.svg)

This cover image received the CSS from the directive above. It renders at 50% width with a blue border and padding.

The next image is plain again -- the styling was consumed by the first image:

![A plain diagram with no styling](images/diagram.svg)

The `image:` directive is one-shot. Use it when you need a single image to stand out without changing every image in the document.

## `table:`

Sets custom column widths for the next table only. Widths are specified as comma-separated percentages or `auto`.

Syntax:

```md
<!-- table: 25%, 50%, 25% -->
```

<!-- table: 25%, 50%, 25% -->

| Directive | Purpose | One-shot |
| --------- | ------- | -------- |
| `image:` | Style next image | Yes |
| `table:` | Set next table column widths | Yes |
| `apply-next:` | Add classes/id to next block | Yes |
| `toc` | Insert table of contents | No |
| `pagebreak` | Start new page | No |

This table has custom column widths. The next table uses default width distribution:

| Feature | Status | Notes |
| ------- | ------ | ----- |
| TOC generation | Ready | From headings |
| Wikilinks | Ready | With cycle detection |
| Themes | Ready | Single CSS file |
| PDF output | Ready | Via Puppeteer |

The `table:` directive is one-shot. Only the table immediately following the directive gets the custom widths.

## `apply-next:`

Adds CSS classes and/or an ID to the next block-level HTML element (heading, paragraph, list, or blockquote).

Syntax:

```md
<!-- apply-next:.classname #element-id -->
```

<!-- apply-next:.wide #heading-demo -->

## Full-Width Heading

This heading receives `class="wide"` and `id="heading-demo"` from the `apply-next` directive above. The `wide` class makes it span both columns in a two-column layout.

The `apply-next` directive is consumed by the very next block element. It is a one-shot, like `image:` and `table:`.

## Container Wrappers

Container directives wrap content in a styled `<div>`. The tag name becomes a CSS class on the wrapper.

### Basic Container

Syntax:

```md
<!-- note -->

Content inside the container.

<!-- /note -->
```

<!-- note -->

**Note:** This text is wrapped in a `<div class="note">`. The `note` class is styled by `theme.css` with a colored left border and subtle background. Containers work with any Markdown content including headings, lists, code blocks, and images.

<!-- /note -->

### Container with Classes and IDs

Add CSS classes (prefixed with `.`) and an ID (prefixed with `#`) to the container wrapper:

Syntax:

```md
<!-- tip .callout-box #tip-1 -->

Content here.

<!-- /tip -->
```

<!-- tip .callout-box #tip-1 -->

**Pro Tip:** This container has both a class and an ID. The tag becomes `class="tip callout-box"` and `id="tip-1"`. Use classes and IDs when you need multiple container variants or want to target specific containers from `theme.css`.

<!-- /tip -->

### Nesting Containers

Containers can be nested. Each container must be properly closed with its matching `/tag`.

<!-- note -->

Outer container content.

<!-- tip -->

Inner container content. The outer container is `note`, the inner is `tip`.

<!-- /tip -->

Back in the outer container.

<!-- /note -->

Containers are auto-closed by `pagebreak` directives. If you leave a container unclosed at the end of the document, MarkPublisher warns you.

<!-- pagebreak -->
