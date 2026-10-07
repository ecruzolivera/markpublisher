---
status: complete
phase: 7
updated: 2026-10-07
---

# Implementation Plan: Codebase Bug Fixes

## Goal

Fix all 12 bugs identified in the codebase review, address its four improvement areas, and verify correct document navigation, Markdown preservation, live preview, CSS/PDF behavior, configuration errors, and supported-runtime installation with focused regression tests.

## Context & Decisions

References in this plan are relative to `docs/plans/`.

| Decision | Rationale | Source |
| --- | --- | --- |
| Keep the existing ESM CLI and Node native test runner | The project runs directly without compilation and has established module and test conventions. | `ref:../../AGENTS.md`, `ref:../../package.json` |
| Keep themes CSS-only and configuration command-only | Fixes should preserve the documented ownership of page geometry and workflow settings. | `ref:../../AGENTS.md`, `ref:../../README.md` |
| Set the minimum Node version to 22.12.0 and test exactly 22.12.0 plus the latest Node 24 patch | The exact minimum catches baseline compatibility regressions; the floating Node 24 lane intentionally follows the same major-version selection as `.nvmrc`. | `ref:../../package-lock.json`, `ref:../../.nvmrc` |
| Give each book render its own shared heading-ID allocator and each page its own footnote namespace | Page-by-page rendering currently resets IDs; process-global state would instead leak across requests and rebuilds. | `ref:../../src/renderer/markdown.js`, `ref:../../src/commands/build.js`, `ref:../../src/commands/serve.js` |
| Use `env.docId` in the locked `markdown-it-footnote@4.0.0` dependency | This version's verified renderer generates matching footnote references and backlinks from that namespace; use the tracked lockfile to identify the implementation version rather than relying on an unversioned installed-file citation. | `ref:../../package-lock.json`, `ref:../../src/renderer/markdown.js` |
| Preserve explicit author IDs and diagnose duplicate targets | Renaming an explicit ID can break authored links. Duplicates remain ambiguous in permissive output, so diagnostics must identify the conflicting targets and strict builds must fail through `build.failOnWarning`. | `ref:../../src/renderer/index.js`, `ref:../../src/commands/build.js` |
| Share page assembly, while leaving build and serve asset strategies explicit | Both commands duplicate metadata/header/page rendering, but build copies/downloads assets while preview serves source assets. | `ref:../../src/commands/build.js`, `ref:../../src/commands/serve.js` |
| Use Markdown-aware destination parsing and one shared fence scanner | Raw regex rewriting corrupts titles, angle-bracket destinations, inline code, and longer fences. Preserve included files' source context when resolving paths. | `ref:../../src/renderer/preprocessor.js`, `ref:../../src/renderer/index.js`, `ref:../../src/paths/resolver.js` |
| Add PostCSS and postcss-value-parser for CSS structure and values | Import qualifiers, nested rules, and declaration order need structural parsing; reuse it for bundling and theme-size extraction. | `ref:../../src/html/assets.js`, `ref:../../src/themes/loader.js` |
| Bind preview to 127.0.0.1 and serve only registered asset files | The current server binds unspecified interfaces and exposes every non-dotfile in the project through `/files`. | `ref:../../src/commands/serve.js` |
| Use unique temporary HTML beside output assets for PDF-only builds | Relative asset links must continue working, but the normal HTML artifact must not be overwritten or deleted. | `ref:../../src/commands/build.js`, `ref:../../src/pdf/generator.js` |
| Test browser behavior and CLI lifecycle where the bugs require it | Source-string assertions cannot verify actual anchor targets, live reload, media conditions, or cleanup after failure. | `ref:../../test/e2e.test.js`, `ref:../../test/pagination-toolbar.test.js`, `ref:../../test/toc-columns.test.js` |

## Finding Coverage

Review IDs correspond to the numbered major findings and improvement bullets in the preceding review.

| ID | Finding | Implementation task | Main verification |
| --- | --- | --- | --- |
| B1 | Cross-page heading and footnote ID collisions | 3.2 | Repeated headings, footnote links/backlinks, TOC targets, repeated render isolation; duplicate explicit IDs diagnosed and rejected in strict builds |
| B2 | Containers not auto-closed at page breaks | 2.3 | Nested wrappers close in reverse order; browser page wrappers remain siblings |
| B3 | Valid Markdown image syntax corrupted | 2.2 | Titles, angle brackets, parentheses, inline code, included-file origins |
| B4 | Shorter fences execute example directives | 2.1 | Four-backtick/three-backtick and tilde fixtures remain one literal code block |
| B5 | Missing-config serve crash and stale live config | 1.3, 5.3 | Start without config; edit input/theme; invalid edit and recovery |
| B6 | CSS import conditions lost; recursive imports unbounded | 4.2 | Media semantics, nested imports, self/mutual cycles, bounded depth |
| B7 | Custom PDF size depends on declaration order | 4.3 | Reordered/interleaved declarations yield the same size and PDF options |
| B8 | Theme-relative preview assets fail | 5.2 | Local fonts/backgrounds/imports load from their actual source directories |
| B9 | Nested config fields not validated | 1.2 | Invalid table types, boolean types, ports, nested unknown keys |
| B10 | Advertised Node version contradicts dependencies | 1.1, 7.3 | Installation and tests on minimum and development runtimes |
| B11 | Preview serves the project beyond localhost | 5.1, 5.2 | Loopback binding; arbitrary project files and traversal requests rejected |
| B12 | PDF-only builds overwrite/delete existing HTML | 6.1 | Existing HTML preserved after successful and failed PDF generation |
| I1 | Duplicated build/serve page assembly | 3.1 | Both commands use the same metadata/render path |
| I2 | Unbounded, duplicate remote downloads | 4.4 | One fetch per concurrent source, timeout, concurrency bound, cleanup on failure |
| I3 | Behavioral test gaps | Every phase; 7.1–7.3 | Actual CLI, server, browser, and filesystem outcomes |
| I4 | Broken package entry point and stale/error diagnostics | 1.3, 1.4, 7.4 | Config exit code 2; diagnostic assertions updated with the fix; package and documentation match actual files |

## Phase 1: Runtime and Configuration Boundaries [COMPLETE]

**Dependencies:** none. Configuration error handling must be available before live-config recovery in Phase 5.

- [x] **1.1 Align runtime support in `package.json` with locked dependencies.**
  - Set `engines.node` to `>=22.12.0`; retain `.nvmrc`'s Node 24 development selection.
  - Synchronize the root package metadata in `package-lock.json` with the engine change.
  - Keep the current dependency versions rather than downgrading Puppeteer/Chokidar to satisfy the obsolete Node 18 declaration.
  - Record the minimum-runtime CI matrix requirement for task 7.3. → `ref:../../package.json`, `ref:../../package-lock.json`, `ref:../../.nvmrc`
- [x] 1.2 Complete nested schema validation in `src/validate/config.js`.
  - Require `output`, `build`, and `serve` to be non-null, non-array tables when supplied.
  - Require booleans for `output.html`, `output.pdf`, and `build.failOnWarning`.
  - Require an integer `serve.port` in 1–65535; tests obtain ephemeral ports with the internal `startPreviewServer({ cwd, portOverride: 0 })` API defined in task 5.1, without adding CLI flags or accepting port 0 in TOML.
  - Warn on unknown keys inside supported tables, following the existing top-level policy.
  - Return fresh nested defaults for each validation call. → `ref:../../src/validate/config.js`
- [x] 1.3 Make `src/config.js` return consistent project context and typed configuration failures.
  - Normalize the starting directory to an absolute path. Set `_configDir` to the discovered config directory, or the starting directory when no config exists.
  - Return/retain the actual discovered config path for the watcher, including when discovery searches parent directories.
  - Wrap TOML syntax and schema errors in a configuration error with source-path details; remove `process.exit()` from the reusable loader.
  - Let `src/cli.js` translate configuration errors to exit code 2 while retaining existing missing-input and render-error codes.
  - Tell users that forbidden geometry keys belong in `theme.css`, replacing the `theme.toml` diagnostic. → `ref:../../src/config.js`, `ref:../../src/cli.js`, `ref:../../src/validate/config.js`
- [x] 1.4 Extend `test/config.test.js` and add config-loader/CLI regressions.
  - Change the existing forbidden-geometry diagnostic assertion from `theme.toml` to `theme.css` alongside task 1.3, so Phase 1's focused suite stays passing.
  - Cover empty config, upward discovery, no-config fallback, invalid nested types, both valid port boundaries, invalid ports, and unknown nested keys.
  - Spawn the real CLI for malformed TOML and schema-invalid TOML; assert exit code 2 and the offending config path.
  - Assert changing one returned default object does not affect subsequent loads.

**Acceptance:** every successful load supplies validated values and an absolute project directory; malformed or schema-invalid config fails clearly with CLI exit code 2; the focused configuration tests pass before advancing to Phase 2.

## Phase 2: Markdown Preservation and Page Boundaries [COMPLETE]

**Dependencies:** none beyond the existing renderer; complete before shared document rendering in Phase 3.

- [x] 2.1 Add `src/renderer/fences.js` and replace duplicated fence handling in preprocessing and directive transformation.
  - Use markdown-it's block-parser source maps to inherit its marker/run-length matching and closing-fence rules.
  - Respect Markdown fence indentation, opener/closer syntax, and list/blockquote contexts instead of interpreting every trimmed marker run as a boundary.
  - Keep includes, directives, and image rewriting inactive inside fenced examples. → `ref:../../src/renderer/preprocessor.js`, `ref:../../src/renderer/index.js`
- [x] 2.2 Replace the raw Markdown image destination regex in `src/renderer/preprocessor.js` with Markdown-aware image recognition/destination parsing.
  - Use markdown-it's image parsing helpers or token/source ranges to distinguish real images from code spans and escaped examples.
  - Resolve only the destination, preserving titles, alt text, angle-bracket paths, escaped characters, balanced parentheses, and supported attributes.
  - Preserve project-root-first/source-file-relative resolution while recursively processing included files.
  - Apply image directives without reparsing the entire destination/title expression as a filename; handle equivalent titled images in `src/renderer/index.js`. → `ref:../../src/renderer/preprocessor.js`, `ref:../../src/renderer/index.js`, `ref:../../src/paths/resolver.js`
- [x] 2.3 Emit matching container closing directives before a page break in `processDirectives()`.
  - Close nested containers in reverse opening order before resetting tracking state.
  - Preserve the existing auto-close warning and unmatched-close behavior.
  - Balance still-open wrappers after Markdown rendering at end of document while retaining the preprocessor's unclosed-container warning; synthetic directives must not alter literal code inside an unfinished fence. → `ref:../../src/renderer/preprocessor.js`, `ref:../../src/renderer/index.js`
- [x] 2.4 Extend `test/preprocessor.test.js` and `test/renderer-directives.test.js` with meaningful regressions.
  - Cover longer fences, shorter marker runs inside them, tildes, directive/include examples, image titles and parentheses, inline code, and included-file image paths.
  - Verify nested closure ordering, end-of-document closure, and unchanged explicit container closure.
  - Use one browser-backed document assertion to verify `.page-shell` elements remain siblings after auto-closure.

**Acceptance:** valid image syntax renders with the correct URL/title; code examples remain literal; each manually split page contains balanced wrapper markup.

## Phase 3: Shared Document Assembly and Unique Navigation [COMPLETE]

**Dependencies:** Phase 2. Phase 5 will consume this shared rendering path.

- [x] 3.1 Add a document/page assembly helper, such as `src/renderer/document.js`, and use it from build and serve.
  - Move the common page loop, role/layout/numbering metadata, running-header context, and warning accumulation out of both commands.
  - Accept an explicit asset-rewrite function: the build uses its bundler and serve uses its asset registry.
  - Preserve intentional blank-page, TOC-page, numbering, and header behavior with existing fixtures. → `ref:../../src/commands/build.js`, `ref:../../src/commands/serve.js`
- [x] 3.2 Introduce an explicit per-document rendering context in `src/renderer/markdown.js` and `src/renderer/index.js`.
  - Create a fresh heading-ID registry per book render and share it across that book's pages; preserve ordinary unique heading slugs and allocate suffixes for generated duplicates.
  - Reserve page-wrapper IDs and explicit author-provided IDs before assigning generated heading IDs, including IDs supplied through `apply-next`.
  - Preserve explicit IDs; report duplicate explicit IDs and conflicts with reserved page-wrapper IDs instead of silently changing author-defined targets. Include the conflicting ID, page numbers, and available source locations in the warning, stating that links to the ID are ambiguous until the author corrects it.
  - In default permissive builds, keep the existing warning behavior and acknowledge that duplicate explicit IDs still resolve ambiguously. With `build.failOnWarning = true`, verify that the warning causes build exit code 3 through the established strict-build policy.
  - Pass a stable, page-specific `env.docId` to the existing footnote plugin so references and backlinks stay on their page.
  - Keep rendering state isolated across repeated builds, preview requests, and separate books. → `ref:../../src/renderer/markdown.js`, `ref:../../src/renderer/index.js`
- [x] 3.3 Add document-navigation regressions using the production template and browser scripts.
  - Render repeated headings on different pages and verify each TOC link resolves to the intended heading/page.
  - Render first footnotes on two pages, including repeated references to a note, and verify matching page-local targets/backlinks.
  - Cover unique explicit IDs, generated-ID collisions with reserved IDs, and deterministic repeated renders.
  - Add a separate duplicate-explicit-ID fixture; assert that IDs are preserved, the warning identifies both targets and explains the ambiguity, and a strict CLI build exits with code 3. Do not count this invalid-authoring fixture as a successful navigation case.
  - Assert that the canonical sample has unique generated IDs and correct TOC destinations; any explicit-ID conflict in that fixture must be reported rather than silently excluded from the assertion.

**Acceptance:** generated heading/footnote IDs are unique across the document; navigation targets the correct page for documents with non-conflicting explicit IDs; duplicate explicit IDs produce actionable ambiguity warnings and fail strict builds; build/serve share one page assembly implementation.

## Phase 4: CSS Imports, Theme Geometry, and Remote Resources [COMPLETE]

**Dependencies:** Phase 1's runtime baseline. Complete before validating preview theme assets in Phase 5.

- [x] 4.1 Add `postcss` and `postcss-value-parser` to `package.json`/`package-lock.json`; isolate shared CSS parsing helpers.
  - Parse imports, URL values, and declarations structurally rather than relying on declaration-order or whole-stylesheet regexes.
  - Carry each stylesheet's local path or remote URL while processing its imports and assets. → `ref:../../src/html/assets.js`, `ref:../../src/themes/loader.js`
- [x] 4.2 Correct import expansion in `src/html/assets.js`.
  - Preserve media conditions and `layer`/`supports` qualifiers with equivalent wrappers around imported rules.
  - Resolve nested URLs against the stylesheet that contains them, preserving applicable URL fragments and query semantics.
  - Track an active canonical import chain: report and omit only cyclic import edges, without treating valid repeated imports in separate branches as cycles.
  - Enforce a maximum import depth of 32 and include the import chain in cycle/depth warnings.
  - Preserve source context in missing-file/download warnings; follow existing `failOnWarning` policy. → `ref:../../src/html/assets.js`
- [x] 4.3 Replace order-sensitive theme-size extraction in `src/themes/loader.js` with parsed declaration lookup.
  - Read `.page` width and height regardless of declaration order, comments, whitespace, or intervening properties.
  - Preserve named `@page` size precedence and documented A4 fallback when no supported size is declared.
  - Handle repeated declarations in source order and report explicit unsupported/invalid dimensions rather than disguising them as an absent declaration. → `ref:../../src/themes/loader.js`, `ref:../../README.md`
- [x] 4.4 Make remote resource handling bounded and deduplicated in `src/html/assets.js`.
  - Cache in-flight resource promises as well as completed resources; concurrent identical requests must share one fetch.
  - Route actual fetches through a concurrency limit of six; do not hold a fetch slot while recursively expanding imports.
  - Apply a 30-second fetch/body-read deadline using cancellation; handle body-read failures as source-specific warnings.
  - Remove failed in-flight entries and clean up partial outputs; retain deterministic collision-safe asset filenames.
  - Keep data URIs and anchor-only references unchanged without spurious missing-asset warnings. → `ref:../../src/html/assets.js`
- [x] 4.5 Extend `test/html-assets.test.js` and `test/theme.test.js`.
  - Cover conditional import output and actual screen/print behavior, nested relative assets, self/mutual cycles, repeated non-cyclic imports, and depth limits.
  - Cover width/height reordering, intervening declarations/comments, named-size precedence, and missing/invalid declarations.
  - Use local HTTP fixtures or injected fetches for deduplication, bounded concurrency, cancellation, body failures, and HTTP errors; avoid external network dependencies.

**Acceptance:** import conditions retain their meaning; cycles terminate with clear warnings; equivalent dimension declarations yield equivalent sizes; downloads are bounded and deduplicated.

## Phase 5: Correct and Scoped Live Preview [COMPLETE]

**Dependencies:** Phases 1, 3, and 4.

- [x] 5.1 Refactor `src/commands/serve.js` into a CLI wrapper and a testable server lifecycle.
  - Export `async startPreviewServer({ cwd = process.cwd(), portOverride } = {})` from `src/commands/serve.js`. Load project configuration relative to `cwd`; `serveCommand()` calls this helper without an override.
  - Start the public preview on `127.0.0.1`; retain the documented localhost URL and config-driven port.
  - Use the validated config port unless the internal `portOverride` is supplied. Validate that override as an integer in 0–65535; 0 requests an operating-system-assigned port for tests only.
  - Resolve startup after the HTTP listener and initial watcher/render setup are ready, returning `{ url, port, close }` with the actual bound port and URL.
  - Make `close()` asynchronous and idempotent; shut down the HTTP server, file watcher, pending rebuild work, and SSE connections for reliable integration-test cleanup.
  - Handle startup/listen errors through the CLI error path rather than an uncaught asynchronous callback. → `ref:../../src/commands/serve.js`
- [x] 5.2 Replace whole-project `/files` static serving with a registered asset endpoint and theme stylesheet endpoint.
  - Register only resolved image, font, background, and imported stylesheet files discovered through the rendering/theme pipeline.
  - Resolve theme-relative references from each stylesheet's actual directory, including global themes and recursively imported stylesheets.
  - Rewrite local references to registered asset URLs; support valid raw HTML image quoting and retain remote/data URLs appropriately.
  - Reject unregistered paths and traversal attempts, using canonical file identities for registrations.
  - Do not restrict legitimate project assets to a single `images/` directory: included sources and user-global themes can reference assets elsewhere. → `ref:../../src/commands/serve.js`, `ref:../../src/html/assets.js`, `ref:../../src/paths/resolver.js`
- [x] 5.3 Refresh preview configuration, rendering context, assets, and watch paths as one coherent snapshot.
  - Re-read config before rebuilding; derive the current absolute input and theme from that config instead of startup constants.
  - Watch the discovered config file, input/includes/references, imported local stylesheets, and registered local assets.
  - Detect creation of a config when startup used defaults, respecting upward discovery.
  - Treat invalid edits, missing input, or missing themes as recoverable preview errors; keep the server alive and show an escaped error response, then recover on the next valid edit.
  - Keep config/reference watchers required for recovery when an attempted update fails; avoid installing half-updated render/asset state.
  - For a changed listen port, show an explicit restart-required diagnostic; apply input/theme changes live without silently attempting a port migration.
  - Debounce and serialize watcher-triggered rebuilds so clients are notified after a coherent refresh. → `ref:../../src/commands/serve.js`, `ref:../../src/config.js`
- [x] 5.4 Add `test/serve.test.js` with HTTP/SSE integration and focused browser checks.
  - Start each fixture with `startPreviewServer({ cwd: fixtureDir, portOverride: 0 })`, use its returned URL, and await `close()` in teardown; avoid fixed-port races and timing-based startup sleeps.
  - Start without config; verify successful rendering and loopback binding.
  - Change input/theme in TOML and assert new content/style, updated watchers, and reload notification; test malformed-config recovery.
  - Test config creation after no-config startup and parent-directory config discovery.
  - Load a theme with a local font, background image, and imported CSS; assert registered requests succeed and the browser uses the expected resources.
  - Assert requests for unrelated project files, unregistered files, and traversal paths fail.
  - Close all servers/watchers/SSE clients/browsers and remove temporary fixtures in teardown.

**Acceptance:** live config edits render current content, valid source assets load, failed edits are recoverable, and arbitrary project files are not served.

## Phase 6: PDF Output and Temporary-File Safety [COMPLETE]

**Dependencies:** Phases 3 and 4.

- [x] 6.1 Change PDF-only output handling in `src/commands/build.js` to create an exclusively allocated, unique temporary HTML file inside `outputDir`.
  - Keep bundled asset URLs valid by placing the temporary HTML alongside `assets/`.
  - Clean up exactly that temporary file in `finally`, on both successful and failed PDF generation.
  - Never overwrite or unlink the ordinary HTML output path when `output.html` is false; preserve the current normal HTML-output path when enabled. → `ref:../../src/commands/build.js`
- [x] 6.2 Add `test/build.test.js` and `test/pdf.test.js` regressions.
  - Pre-create a sentinel normal HTML artifact; verify its bytes are unchanged after PDF-only success and failure.
  - Verify generated PDF existence on success, correct error behavior on failure, and no leftover temporary HTML in either case.
  - Use an injected PDF-generation function for deterministic failure-path checks and one real Puppeteer integration for relative assets.
  - Verify custom dimensions reach `page.pdf()` correctly and a real custom-size PDF has the expected page dimensions, using a test-only PDF metadata reader.
  - Exercise HTML-only, PDF-only, and combined output configurations.

**Acceptance:** PDF-only builds preserve existing HTML artifacts, clean up only their own temporary input, and produce correctly sized PDFs with working assets.

## Phase 7: Integration Coverage, Packaging, and Documentation [COMPLETE]

**Dependencies:** all preceding phases.

- [x] 7.1 Run focused regressions after each affected phase, then the documented full-suite check after integration.
  - Preserve the required command: `rm -rf test/fixtures test/assets-fixtures test/path-fixtures && npm test`.
  - Add teardown hooks for newly added fixtures/resources so failed assertions do not leave stale state.
  - Use native Node assertions and browser behavior checks, not tests that merely mirror implementation strings. → `ref:../../AGENTS.md`, `ref:../../package.json`
- [x] 7.2 Exercise the canonical sample end to end.
  - Use an isolated temporary copy of `samples/sample-book/` so existing local output artifacts are preserved.
  - Invoke the actual CLI build with the copied sample as its working directory; verify HTML/PDF output, unique generated IDs, TOC links, numbering, and toolbar behavior.
  - Start serve for the copied sample and verify shared rendering behavior and live reload.
  - Keep deterministic regression fixtures local/offline; retain the canonical sample's remote-font warnings where its unchanged theme legitimately uses remote resources. → `ref:../../samples/sample-book/book.md`, `ref:../../samples/sample-book/themes/default/theme.css`
- [x] 7.3 Add `.github/workflows/test.yml` with an exact Node `22.12.0` lane and a Node `24` lane that resolves the latest patch in that major, matching `.nvmrc`'s intentional floating selection.
  - Use `npm ci`, configure Puppeteer's Chromium/system dependencies, and run the full native test suite on both runtimes.
  - Run packaging/CLI smoke checks from `npm pack` in temporary directories, verifying both declared bin entries and required template/browser-script files.
  - Use one controlled offline project for build/serve smoke checks; do not require Google Fonts availability for CI success. → `ref:../../package.json`, `ref:../../package-lock.json`
- [x] 7.4 Correct package metadata and current contributor/user documentation.
  - Remove the nonexistent `main: "src/index.js"` entry for this CLI-only package; retain both documented bin entries.
  - Update README/CONTRIBUTING to describe the supported Node baseline, CSS-only themes, actual module/sample paths, loopback preview, port-restart behavior, and invalid-config exit code 2.
  - Verify the `theme.css` diagnostic and its test assertion changed together in Phase 1; keep Phase 7 focused on documentation/packaging consistency rather than deferring an earlier test fix.
  - Document any new warning semantics for duplicate explicit IDs and cyclic/unsupported CSS resources. → `ref:../../package.json`, `ref:../../README.md`, `ref:../../CONTRIBUTING.md`, `ref:../../test/config.test.js`
- [x] 7.5 Reconcile the coverage matrix with implemented tests, inspect the final diff, and mark this plan complete only after all acceptance criteria pass.

**Acceptance:** all 12 bug findings and four improvement areas have an implemented resolution; focused and full-suite checks pass; sample and packed-package smoke checks pass on supported runtimes; docs match the implementation.

## Execution and Verification Notes

- All seven implementation phases are complete; phase checklists and the verification record below identify the implemented fixes and checks.
- Prefer one cohesive change set per phase. Add reproductions and fixes together, then run the relevant tests before advancing.
- New tests should use isolated temporary directories, unique ports, deterministic local assets, and teardown hooks; they should assert externally meaningful outcomes.
- Proposed internal defaults are CSS import depth 32, remote fetch concurrency six, and a 30-second resource deadline. Keep these as named internal constants rather than introducing CLI flags or additional public config solely for these fixes.
- Browser scripts remain separate plain JS files, injected through the existing template helpers. Toolbar padding stays server-side, and PDF input continues to load through `file://`.
- Existing manual pagination and explicit-ID authoring remain supported. Duplicate explicit IDs are an authoring error: preserving them leaves TOC/in-page targets ambiguous, so permissive builds must warn with conflicting locations and strict builds must fail. Navigation correctness is guaranteed only when explicit IDs do not conflict.
- The `env.docId` behavior was verified in the installed `markdown-it-footnote@4.0.0` renderer, identified by the tracked lockfile. Recheck its ID/reference behavior if that dependency is upgraded.
- 2026-10-07 plan review refinements: clarified explicit-ID ambiguity and strict-build behavior; defined the internal server startup/cleanup contract; moved the diagnostic assertion update into Phase 1; tied the footnote decision to the locked dependency version; made minimum-runtime versus floating development-runtime CI intent explicit.
- 2026-10-07 review baseline: 32 non-writing tests passed before implementation; read-only probes reproduced duplicate IDs, missing container closers, image syntax corruption, shorter-fence misclassification, stale preview input, missing config directory, lost import conditions, recursive imports, and order-sensitive dimensions.
- 2026-10-07 implementation: focused tests cover configuration, Markdown preservation, cross-page navigation, conditional CSS, resource bounds, scoped live preview, and PDF cleanup. Additional regressions cover URI-encoded TOC fragments, raw HTML headings, toolbar-ID reservations, indented examples, and included images with URL suffixes.
- 2026-10-07 integration: the canonical sample is copied to a temporary directory and built through the actual CLI. Only its remote font-import URL is redirected to a local HTTP fixture for deterministic offline CI; the original sample and existing output artifacts remain untouched. Both packed-package bins and the packed preview module are smoke-tested.
- 2026-10-07 dependency audit: compatible updates raised markdown-it to 14.3.2 and TOML to 4.3.0 and removed all reported high/critical advisories. Four moderate advisories remain in gray-matter's js-yaml/argparse/sprintf-js chain; npm's forced remedy is a breaking gray-matter downgrade, so it was not applied.
- 2026-10-07 final verification: all 129 tests passed on both Node 22.12.0 and Node 24.21.0, with zero failures or skips. Node 24's coverage report recorded 93.60% source-line coverage. The suite includes real Chromium navigation, local font loading, custom-size PDFs, the canonical sample CLI build, packed-package bins, preview lifecycle, and live-edit recovery.
- 2026-10-07 final refinements: literal-code detection delegates to the renderer's block grammar, including quoted/list fences and footnotes; EOF wrappers close after rendering so unfinished fences cannot swallow synthetic directives. Image rewriting preserves literal encoded filename characters and existing image attributes.
- 2026-10-07 watcher recovery: Chokidar tracks known files, supplemented by scoped native parent-directory observers for creations and atomic replacements. Dependency filtering keeps unrelated filesystem events out of the rebuild queue; all observers close with the server. The Node 24 preview suite also passed three consecutive targeted stress runs after fixing the watch-registration race.
- Final CSS regressions verify that cached local imports retain their individual origin directories, HTTP redirect cycles terminate, and strict builds validate geometry after import expansion. Global theme discovery candidates are watched before parsing so an invalid newly selected global theme can recover when edited.
- CI is configured for both supported runtimes in `.github/workflows/test.yml`; hosted GitHub Actions runs require pushing the changes. The canonical sample's existing files/output artifacts were not modified by verification.
