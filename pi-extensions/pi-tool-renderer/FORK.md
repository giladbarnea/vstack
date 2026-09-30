# Keep the curated fork close to upstream

The fork started as a surgical extraction of richer edit/write diffs. The earlier policy lived in `~/.pi/agent/extensions/rich-tool-diff/FORK.md`, deleted in that repository's commit `0400c37`.

## Keep upstream code inside the selected boundary

The root manifest loads read, Bash, edit, write, grep, find, and ls renderers, plus native-tool grouping. The curated entry point imports the renderer modules directly. Do not copy or rewrite their styling, path links, or settings logic.

Global UI patches, generic/MCP rendering, `tool_batch`, and the monorepo's skills and agents remain excluded. These exclusions are intentional, not missing updates. Compatibility fixes belong upstream when possible.

## Remove personal read-many-files support when another solution exists

`vstack-fork-read-many-files.ts` is necessary but unwanted drift. VStack currently has no protocol for a personal tool to register its renderer. Keep this adapter outside the upstream renderer modules. Remove it as soon as another solution lets the personal tool own its renderer while using VStack's style.

The personal tool requests call/result components through Pi's shared event bus, on `gilad:read-many-files:render`. The adapter uses upstream tree rows, path links, preview limits, image rendering, and settings. It does not register or execute the tool. Without the adapter, the personal tool uses its existing renderer.

## Update the installed fork through Pi

The installed package source is `git:github.com/giladbarnea/vstack`. After publishing an approved change, run `pi update git:github.com/giladbarnea/vstack`, then `/reload`. Do not also load a separate local renderer copy.
