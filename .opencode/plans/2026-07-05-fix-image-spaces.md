---
status: not-started
phase: 1
updated: 2026-07-05
---

# Implementation Plan: Fix Image Resolution for Paths with Spaces

## Goal

Fix the image resolution pipeline so that images referenced in markdown render correctly as `<img>` tags when the absolute file path contains spaces (e.g., `La Sombra del Calabozo`), by wrapping resolved paths in CommonMark angle brackets.

## Context & Decisions

| Decision | Rationale | Source |
|---|---|---|
| Use CommonMark angle bracket syntax `![alt](<path>)` | Markdown-it parses paths containing spaces correctly only when wrapped in `<>`. Plain `![alt](path with spaces)` is rendered as literal text. | `ref:./src/renderer/preprocessor.js` lines 137, 190; `ref:./src/renderer/markdown.js` line 10-17 |
| Strip `<>` brackets in `transformDirectives` | The `<!-- image: ... -->` CSS-application regex extracts `src` from `![...](...)`. If `src` includes `<>` characters, the resulting markdown syntax would be invalid. | `ref:./src/renderer/index.js` lines 125-133 |
| Leave asset bundler unchanged | The asset bundler already handles spaces in absolute paths correctly via `path.normalize()` and `fs.copyFileSync()`. | `ref:./src/html/assets.js` lines 106-122, 226-254 |
| Keep wikilink and markdown image paths consistent | Both wikilink images (`![[...]]`) and standard markdown images (`![alt](...)`) get resolved to absolute paths in the preprocessor. Both need the same fix. | `ref:./src/renderer/preprocessor.js` lines 135-140, 181-191 |

## Phase 1: Implementation [PENDING]

- [ ] **1.1 Wrap resolved image paths in angle brackets in preprocessor** ← CURRENT
  - In `src/renderer/preprocessor.js` line 137, change:
    - `result.push(\`![${alt}](${canonical})\`);` → `result.push(\`![${alt}](<${canonical}>)\`);`
  - In `src/renderer/preprocessor.js` line 190, change:
    - ``return \`![${alt}](${resolved})\`;`` → ``return \`![${alt}](<${resolved}>)\`;``
  - In `src/renderer/preprocessor.js` line 201, change:
    - ``return \`<img${beforeSrc} src=${quote}${resolved}${quote}${afterSrc}>\`;`` → ``return \`<img${beforeSrc} src=${quote}${resolved}${quote}${afterSrc}>\`;`` *(no change needed for HTML tags, spaces in `src` attribute values are valid HTML)*

- [ ] 1.2 Strip angle brackets in `transformDirectives` when extracting image src
  - In `src/renderer/index.js` line 128, after extracting `src` from the regex match, strip leading `<` and trailing `>`:
    - `const src = imageMatch ? imageMatch[2].replace(/^<|>$/g, '') : '';`
  - Verify that the regex on line 125 still matches `![alt](<path>)` syntax — the `.+?` inside `\((.+?)\)` will capture `<path>` including the brackets, which is expected and handled by the strip above.

## Phase 2: Verification [PENDING]

- [ ] 2.1 Run the project's existing test suite:
  - `rm -rf test/fixtures test/assets-fixtures test/path-fixtures && npm test`
- [ ] 2.2 Build the sample book to ensure no regressions:
  - `cd samples/sample-book && node ../../src/cli.js build`
- [ ] 2.3 Build the user's book to confirm images render as `<img>` tags:
  - `cd ~/TTRPG/La Sombra del Calabozo/La Sombra del Calabozo && node /home/ernesto/Work/Personal/markpublisher/src/cli.js build`
  - Verify `output/La Sombra del Calabozo.html` contains `<img src="...duelo_defensiva.jpg">` instead of literal `![duelo_defensiva](...)`

## Notes

- 2026-07-05: The output HTML currently shows `![duelo_defensiva](/home/ernesto/...La Sombra del Calabozo/.../duelo_defensiva.jpg)` as literal text. This confirms markdown-it is not parsing the image due to unescaped spaces in the path. `ref:./output/La Sombra del Calabozo.html` lines 3399-3400.
- 2026-07-05: The `image-wait-script.js` injected by the template waits for all `<img>` elements to load before PDF generation. If images are not parsed as `<img>` tags, this script silently does nothing for those images. `ref:./src/html/image-wait-script.js`
- 2026-07-05: The wikilink image path `![[images/duelo_defensiva.jpg]]` is converted to standard markdown image syntax by the preprocessor. Both references at lines 770 and 772 of `03-Aventurándose.md` result in the same unparseable output due to spaces. `ref:./capitulos/03-Aventurándose.md` lines 770-772.
