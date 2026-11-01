# Keep the curated fork close to upstream

The [root fork guide](../../FORK.md) defines this fork's purpose, responsibility boundary, and upstream relationship.

This policy classifies differences in the selected Pi renderer package. The fork started as an edit/write renderer extraction. The earlier policy lived in `~/.pi/agent/extensions/rich-tool-diff/FORK.md`, deleted in that repository's commit `0400c37`.

## 1. Preserve intentional product and behavior drift

The root manifest selects read, Bash, grep, find, and ls renderers, optional edit/write renderers, native-tool grouping, and the renderer settings dialog. The curated entry point imports upstream modules directly. Do not copy or rewrite their styling, path links, or settings logic.

The settings dialog is `/extensions:settings`, not Pi's built-in `/settings`. It reuses upstream's dialog without loading the package browser. The root manifest exposes five upstream settings: `enabled`, `renderMutationTools`, `stackToolCalls`, `stackChildDisplay`, and `showReadImages`. Its package name matches the renderer config identity so the dialog writes the settings the renderer reads.

Global UI patches, generic/MCP rendering, `tool_batch`, and the monorepo's skills and agents remain excluded. These exclusions are intentional, not missing updates.

Renderer activation follows upstream: `enabled` defaults to true, and `renderMutationTools` defaults to false. The dialog remains available when renderers are disabled. Do not enable edit/write renderers unconditionally.

Read, Bash, grep, find, and ls use Pi 1.0.2 native `registerToolRenderer` resolvers. They do not register or execute tools. Read labels omit ignored ranges when the tool owner supports `forceFull`. Optional edit/write wrappers still collect diff metadata.

## 2. Remove unfortunate necessities when another solution exists

There are no current custom-tool renderer adapters.

## 3. Minimize being behind upstream before starting work

Being behind upstream normally means a rebase has not happened yet, not that older behavior is preferred. Before changing this fork, fetch upstream, compare the selected code, and assess rebasing. Prefer alignment before feature work. If alignment needs a larger migration, explain that decision before proceeding. Already-merged upstream fixes are not personal drift.

Last checked on 2026-10-04 against `upstream/main` at `18c27530`. Upstream moved to Kendex and imported the catalog with unrelated Git history. A full rebase replaces the repository base and needs a settings-namespace migration. The current fork still uses `vstack.extensionManager.config`; current upstream uses `kendex.extensionManager.config`.

Pending selected-code updates include the newer settings reader (`6948c0f3`), tool-contract preservation for optional edit/write wrappers (`143beaa3`), and bounded grouped-call retention (`fb55afe5`). Native read/Bash/search renderers no longer replace tool contracts. These remaining updates are gaps, not intentional product drift. Unselected upstream features do not belong in this backlog.

## 4. Suspect undocumented drift is unintentional

Treat any upstream difference not classified here as potentially unintentional. Ask Gilad whether he knows about it. If he does, classify it here with his decision. If he does not, get his action item rather than silently accepting the difference.

## Load one fork copy

The personal installation loads `~/dev/vstack` as a local Pi package. After changing this checkout, run `/reload`. Do not also load the GitHub package. GitHub installs use the update steps in [README.md](README.md#personal-curated-fork).
