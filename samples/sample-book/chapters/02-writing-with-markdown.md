# Chapter 2: Writing a Multi-File Book

MarkPublisher supports multi-file projects through wikilink includes. This chapter covers front matter, chapter includes, partials, and image references.

## Front Matter

Every book starts with YAML front matter in `book.md`. This metadata appears in the output document's `<head>`:

```yaml
---
title: MarkPublisher Tutorial
author: Ernesto Cruz Olivera
lang: en
---
```

Supported fields are `title`, `author`, `date`, and `lang`.

## Including Chapters

Use the wikilink include syntax to pull content from other files. The general form is `![[path/to/file]]`.

Rules for includes:

- Resolved project-root-first, then relative to the source file
- `.md` is appended automatically if the extension is omitted
- Includes can be nested (chapters can include partials, partials can include other partials)
- Circular includes are detected and produce a visible placeholder
- Missing files produce a `[Missing: path]` placeholder
- Maximum include depth is 10 levels

The `book.md` for this tutorial uses includes to pull in each chapter. This keeps the entry file short and each chapter self-contained.

<!--pagebreak-->

![[chapters/02.1-reusable partials]]

<!--pagebreak-->

## Images

Images are supported with standard Markdown syntax:

![A diagram from images/](images/diagram.svg)

Or with wikilink syntax for a shorter form:

![[images/cover.jpg]]

Both resolve to the correct filesystem path. Project-root-first resolution means image paths work the same way from any chapter file.

<!-- pagebreak -->
