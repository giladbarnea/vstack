# Keep rendering separate from tool ownership

`registerRead`, `registerBash`, and `registerReadOnly` use Pi 1.0.2's `registerToolRenderer` resolver API. Each resolver handles its tool name and calls `next()` for other names. The existing rendering callbacks stay unchanged.

A renderer does not register, execute, or activate a tool. The tool owner keeps the complete definition, including parameters, argument preparation, constrained sampling, and structured results. This avoids startup conflicts and package-order dependence. Optional edit/write wrappers still collect diff metadata and remain execution wrappers.

The curated entry point and the full entry point share these registrations. [FORK.md](FORK.md) defines the curated scope and remaining upstream gaps.

## Test the real Pi boundary

With Bun and the Pi peer dependencies available, run from the repository root:

```sh
bun test ./pi-extensions/pi-tool-renderer/extensions/__tests__
```

Keep the `./` prefix. Without it, Bun treats the directory as a test-name filter and can run cached checkout tests.

`native-renderers.test.ts` uses `DefaultResourceLoader` to exercise startup conflict diagnostics. It checks intact tool definitions, both extension orders, real Bash structured results and session metadata, and Pi's `ToolExecutionComponent` collapsed/expanded rendering. Image tests isolate the global settings directory.

The local integration with Tool Output Kit passed in both package orders: `forceFull`, invalid-range overrides, large reads, cross-tool deduplication, and terminal rendering stayed intact. Live checks with the local renderer enabled also passed a 250,000-character read, nested execution, duplicate references, changed and reverted files, partial reads, repeated errors, and structured Bash results. The saved personal settings loaded without conflicts in a fresh resource loader and a fresh Pi CLI process. Read labels omit ranges that `forceFull` ignores.
