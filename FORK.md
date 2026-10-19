# Fork: curated Pi tool renderers

## Purpose and justification

This fork provides Gilad's selected Pi tool displays without installing the rest of the upstream catalog. It reuses upstream renderer modules rather than maintaining a separate visual implementation.

The root `package.json` selects the personal entry point. The upstream monorepo remains in the checkout because that entry point imports its renderer and settings components.

## Place in the chain

1. **Parent:** [vanillagreencom/kendex](https://github.com/vanillagreencom/kendex), formerly vstack. Its [README](https://github.com/vanillagreencom/kendex/blob/main/README.md) describes the full catalog.
2. **This fork:** [giladbarnea/vstack](https://github.com/giladbarnea/vstack), at `~/dev/vstack`.

There are no known child forks. Tool-output-kit is a separate integration partner, not a child fork.

## Responsibility boundary

This fork owns the personal selection of renderers, their Pi integration, and the temporary adapter for tool-output-kit's `read_many_files` display. It preserves the chosen upstream appearance and settings.

Tool execution, returned content, large-output policy, and model-context deduplication belong to their tool owners, including [tool-output-kit](/Users/giladbarnea/dev/pi-extensions/tool-output-kit/README.md). They do not belong in this renderer fork.

Global UI changes, generic/MCP rendering, `tool_batch`, and upstream's unrelated skills and agents remain deliberately excluded. A new upstream feature outside the selected scope is not a missing update.

## Change triage and local records

Follow the [shared fork guide](/Users/giladbarnea/.agents/skills/open-source-contribution-attitude/references/fork.md) for categories, placement, and handling protocols.

The [renderer fork policy](pi-extensions/pi-tool-renderer/FORK.md) records the actual intentional drift, unfortunate necessity, upstream gaps, and installation rules. Keep renderer-specific records there rather than duplicating them here.
