---
status: complete
phase: 6
updated: 2026-06-02
---

# Implementation Plan: Marksman file-path-stem Wikilink Resolution

## Goal

Resolve `![[wikilink]]` includes using project-root-first resolution (file-path-stem style) with automatic fallback to source-file-relative resolution, matching Marksman `[completion.wiki] style = "file-path-stem"` behavior.

## Context & Decisions

| Decision | Rationale | Source |
|---|---|---|
| Project-root-first, source-file-relative fallback | Allows clean `![[partials/callout]]` from any depth while preserving backward compatibility with existing `![[../partials/callout]]` paths during the transition | User requirement, `ref:./samples/sample-book/.marksman.toml` |
| Thread `projectRoot` as optional third param to `preprocess()` | Adds new capability without breaking existing 2-arg callers (backward-compatible API change) | `ref:./src/renderer/preprocessor.js:26` |
| Only affects `![[...]]` wikilinks, not `![...](...)` markdown images | Image paths already have their own resolution logic via `resolveImage` and preprocessing-time absolute path rewriting; mixing wikilinks with image resolution would be incorrect | `ref:./src/renderer/preprocessor.js:115-143`, `ref:./src/paths/resolver.js:16-19` |
| Still append `.md` when no extension given | Maintains current behavior so `![[partials/callout]]` and `![[partials/callout.md]]` both work | `ref:./src/paths/resolver.js:10-12` |
| Only scan the project root directory, not a full recursive vault scan | Marksman file-path-stem resolves relative to the vault root, not via recursive fuzzy search; this keeps implementation simple and predictable | `ref:./samples/sample-book/.marksman.toml` |

## Phase 1: Path Resolver Changes [COMPLETE]

- [x] **1.1 Add `resolveWikiInclude(target, projectRoot, sourceFile)` to `src/paths/resolver.js`**
  - New function with project-root-first fallback logic
  - Signature: `resolveWikiInclude(target, projectRoot, sourceFile)`
  - Logic:
    1. If `projectRoot` is provided, compute `path.resolve(projectRoot, target)`, append `.md` if no extension
    2. If that resolved path exists on disk → return it
    3. Fall back to source-file-relative: `path.resolve(path.dirname(sourceFile), target)`, append `.md`
    4. Return that path (even if it doesn't exist — caller handles existence check)
  - Keep existing `resolveInclude(target, sourceFile)` unchanged for backward compat
- [x] 1.2 Add test for the new function in `test/paths.test.js`
  - Project-root resolves existing file at root level
  - Project-root fails to find file, falls back to source-file-relative
  - No project root given → behaves exactly like current `resolveInclude`
  - Target already has an extension → not duplicated (e.g. `![[foo.md]]` stays `foo.md`)

## Phase 2: Preprocessor Changes [COMPLETE]

- [x] 2.1 Add optional `projectRoot` parameter to `preprocess(sourcePath, warnings, projectRoot)`
  - `projectRoot` defaults to `undefined`
  - Passed through to `resolveIncludes()` → `resolveWikiInclude()`
- [x] 2.2 Thread `projectRoot` through `resolveIncludes()` to wikilink resolution
  - At line 77, replace `resolveInclude(target, sourcePath)` with `resolveWikiInclude(target, projectRoot, sourcePath)`
  - Rest of the function (visited tracking, file read, recursion) unchanged
- [x] 2.3 Image path resolution (`resolveLocalMarkdownImages`) is NOT affected
  - It uses `resolveImage()` which stays source-file-relative — images are not wikilinks
  - This is correct: `![Cover](../images/cover.svg)` from a chapter should resolve relative to that chapter
- [x] 2.4 Verify that included file resolution (line 98, second-level includes) also gets `projectRoot` threaded correctly
  - The recursive call `resolveIncludes(includeBody, resolvedPath, warnings, depth + 1, ...)` should pass `projectRoot` unchanged
  - This ensures wikilinks inside included files also use project-root-first resolution

## Phase 3: Build & Serve Integration [COMPLETE]

- [x] 3.1 Pass `config._configDir` to `preprocess()` in `src/commands/build.js` line 25
  - Change: `preprocess(absInput, warnAll)` → `preprocess(absInput, warnAll, config._configDir)`
- [x] 3.2 Pass `config._configDir` to `preprocess()` in `src/commands/serve.js`
  - Line 34 (`buildHtml`): `preprocess(absInput, warnAll)` → `preprocess(absInput, warnAll, config._configDir)`
  - Line 132 (watcher init): `preprocess(absInput, [])` → `preprocess(absInput, [], config._configDir)`
  - Line 145 (`refreshWatchPaths`): `preprocess(absInput, [])` → `preprocess(absInput, [], config._configDir)`

## Phase 4: Sample File Cleanup [COMPLETE]

- [x] 4.1 Fix `samples/sample-book/chapters/01-getting-started.md` line 31:
  - Old: `![[../partials/callout]]`
  - New: `![[partials/callout]]`
  - (Using cleaner project-root form now that it's supported)
- [x] 4.2 Fix `samples/sample-book/chapters/04-appendix.md` line 9:
  - Old: `![[../partials/glossary]]`
  - New: `![[partials/glossary]]`
- [x] 4.3 No changes needed for `book.md` — its wikilinks (`![[chapters/01-getting-started]]`) already resolve correctly in both modes
- [x] 4.4 No changes needed for `02-layouts.md` — no wikilinks, only images
- [x] 4.5 No changes needed for `03-advanced.md` — no wikilinks

## Phase 5: Tests [COMPLETE]

- [x] 5.1 Add test: `![[partials/callout]]` from `chapters/somefile.md` with project root resolves to `partials/callout.md` at project root
- [x] 5.2 Add test: `![[missing-at-root]]` from any file falls back to source-file-relative resolution
- [x] 5.3 Add test: existing wikilinks in `book.md` (at project root) still work unchanged
- [x] 5.4 Add test: circular include detection still works across project-root-resolved includes
- [x] 5.5 Add test: `preprocess()` called without `projectRoot` uses source-file-relative only (backward compat)
- [x] 5.6 Add test: missing include warning still emitted when neither project-root nor source-relative find the file

## Phase 6: Verification [COMPLETE]

- [x] 6.1 Run `node --test test/**/*.test.js` — all tests pass
- [x] 6.2 Build `samples/sample-book` — no missing-include warnings
- [x] 6.3 Verify generated HTML contains content from `partials/glossary` and `partials/callout`
- [x] 6.4 Verify generated PDF still renders correctly

## Files Changed Summary

| File | Lines | Change |
|---|---|---|
| `src/paths/resolver.js` | +15 | Add `resolveWikiInclude()` |
| `src/renderer/preprocessor.js` | ~3 lines | Add `projectRoot` param, use new resolver |
| `src/commands/build.js` | 1 line | Pass `config._configDir` |
| `src/commands/serve.js` | 3 lines | Pass `config._configDir` in 3 places |
| `samples/sample-book/chapters/01-getting-started.md` | 1 line | Clean up wikilink path |
| `samples/sample-book/chapters/04-appendix.md` | 1 line | Clean up wikilink path |
| `test/paths.test.js` | +35 | Test `resolveWikiInclude()` |
| `test/preprocessor.test.js` | +45 | Test project-root wikilink resolution |

## Notes

- 2026-06-02: Current wikilinks resolve only relative to the source file. This plan adds project-root-first resolution as a new optional mode, keeping backward compatibility when no project root is provided.
- 2026-06-02: The `![[01-toc]]` example from the original request is a separate feature (partial/fuzzy stem matching) and is explicitly not covered by this plan — it would require a vault-scan approach with alias support.
- 2026-06-02: Image paths (`![alt](path)`) are deliberately not affected by this change. They continue to use source-file-relative resolution because images are not wikilinks and the source-file context matters for asset bundling via absolute path rewriting.
- 2026-06-02: Implemented. 60 tests passing. Sample-book builds without missing-include warnings. Both `![[partials/callout]]` and `![[partials/glossary]]` resolve correctly from chapter files using project-root-first resolution with source-file-relative fallback. `ref:./src/paths/resolver.js`, `ref:./src/renderer/preprocessor.js`, `ref:./src/commands/build.js`, `ref:./src/commands/serve.js`
