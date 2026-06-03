Directive
: An HTML comment that controls MarkPublisher's rendering behavior. Directives use `<!-- ... -->` syntax and are invisible in standard Markdown editors.

Theme
: A named directory containing a `theme.css` file. The theme controls page size, typography, colors, and component styling.

Include
: A `![[path]]` wikilink that inlines the content of another Markdown file into the current document.

One-shot Directive
: A directive that affects only the next matching element and is consumed immediately. `image:`, `table:`, and `apply-next:` are one-shot.

Persistent Directive
: A directive whose state continues across page breaks until explicitly changed. `layout:`, `page-number:`, and `header:` are persistent.
