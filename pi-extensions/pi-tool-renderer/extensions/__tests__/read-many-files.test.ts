import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createEventBus, DefaultResourceLoader, SettingsManager, type Theme } from "@earendil-works/pi-coding-agent";
import { resetCapabilitiesCache, setCapabilities, visibleWidth, type Component } from "@earendil-works/pi-tui";

import curatedRenderers from "../vstack-fork-adapted-tool-renderers.js";
import { stripAnsi } from "../tool-renderer/ansi.js";
import { recordProjectTrust } from "../tool-renderer/settings.js";

const content = [
	{ type: "text", text: "<a.ts>\n1   alpha\n</a.ts>" },
	{ type: "text", text: "<b.ts>\n1   beta\n2   gamma\n</b.ts>" },
];

const directories: string[] = [];
const theme = {
	bold: (text: string) => `\x1b[1m${text}\x1b[22m`,
	fg: (_token: string, text: string) => text,
} as Theme;

afterEach(() => {
	resetCapabilitiesCache();
	for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

async function fixture() {
	const cwd = mkdtempSync(join(tmpdir(), "read-many-files-renderer-"));
	directories.push(cwd);
	const events = createEventBus();
	const loader = new DefaultResourceLoader({
		cwd,
		agentDir: cwd,
		settingsManager: SettingsManager.inMemory(),
		eventBus: events,
		noExtensions: true,
		noSkills: true,
		noPromptTemplates: true,
		noThemes: true,
		noContextFiles: true,
		extensionFactories: [curatedRenderers],
	});
	await loader.reload();
	expect(loader.getExtensions().errors).toEqual([]);
	const context = {
		args: { paths: ["a.ts", "b.ts"] }, cwd, state: {}, toolCallId: "read-many",
		isError: false, executionStarted: true, argsComplete: true,
		isPartial: false, expanded: false, showImages: true, invalidate() {}, lastComponent: undefined,
	};
	function render(details: Record<string, unknown>, expanded = false): string[] {
		const request = {
			phase: "result", result: { content, details }, options: { expanded, isPartial: false },
			theme, context, component: undefined as Component | undefined,
		};
		events.emit("gilad:read-many-files:render", request);
		expect(request.component).toBeDefined();
		return request.component!.render(120).map(stripAnsi);
	}
	function settings(config: Record<string, unknown>): void {
		mkdirSync(join(cwd, ".pi"), { recursive: true });
		writeFileSync(join(cwd, ".pi", "settings.json"), JSON.stringify({
			vstack: { extensionManager: { config: { "@vanillagreen/pi-tool-renderer": config } } },
		}));
		recordProjectTrust({ cwd, isProjectTrusted: () => true });
	}
	return { cwd, events, context, render, settings };
}

test("curated fork renders multiple files like grouped native reads", async () => {
	const { cwd, events } = await fixture();
	setCapabilities({ images: undefined, hyperlinks: true, trueColor: true });
	const request = {
		phase: "result",
		result: {
			content: [{ type: "text", text: "<a.ts>\n1   alpha\n</a.ts>\n\n<b.ts>\n1   beta\n2   gamma\n</b.ts>" }],
			details: { paths: ["a.ts", "b.ts"], fileLineCounts: [1, 2], hiddenIndexes: [], newLineCount: 3 },
		},
		options: { expanded: false, isPartial: false },
		theme,
		context: {
			args: { paths: ["a.ts", "b.ts"] }, cwd, state: {}, toolCallId: "read-many",
			isError: false, executionStarted: true, argsComplete: true,
			isPartial: false, expanded: false, showImages: true, invalidate() {}, lastComponent: undefined,
		},
		component: undefined as Component | undefined,
	};
	events.emit("gilad:read-many-files:render", request);
	expect(request.component, "The installed curated factory must answer the personal tool's render request").toBeDefined();
	const lines = request.component!.render(120);
	expect(lines.map(stripAnsi)).toEqual([
		"● Read 2 files · done",
		"  ├─ Read a.ts · 1 line",
		"  └─ Read b.ts · 2 lines",
	]);
	expect(lines[1]).toContain(`\x1b]8;;file://${cwd}/a.ts`);
	for (const width of [20, 40, 80]) {
		expect(request.component!.render(width).every((line) => visibleWidth(line) <= width)).toBe(true);
	}
});

test("unchanged files use index metadata so duplicate paths stay distinct", async () => {
	const { render } = await fixture();
	expect(render({ paths: ["a.ts", "a.ts"], fileLineCounts: [4, 4], hiddenIndexes: [1], hiddenPaths: ["a.ts"] })).toEqual([
		"● Read 2 files · done",
		"  ├─ Read a.ts · 4 lines",
		"  └─ Read a.ts · unchanged",
	]);
});

test("failed files do not report success or zero lines", async () => {
	const { render } = await fixture();
	expect(render({ paths: ["a.ts", "missing.ts"], fileLineCounts: [1, 0], failedIndexes: [1] })).toEqual([
		"● Read 2 files · failed",
		"  ├─ Read a.ts · 1 line",
		"  └─ Read missing.ts · failed",
	]);
});

test("tool errors mark file rows as failed", async () => {
	const { context, render } = await fixture();
	context.isError = true;
	expect(render({ paths: ["a.ts"], fileLineCounts: [0] })).toEqual([
		"● Read 1 file · failed", "  └─ Read a.ts · failed",
	]);
});

test("expanded output includes every text block without copy gutters and respects the preview limit", async () => {
	const { render, settings } = await fixture();
	const details = { paths: ["a.ts", "b.ts"], fileLineCounts: [1, 2] };
	const expanded = render(details, true);
	expect(expanded.slice(3)).toEqual(["<a.ts>", "1   alpha", "</a.ts>", "", "<b.ts>", "1   beta", "2   gamma", "</b.ts>"]);
	expect(render(details)).toHaveLength(3);
	settings({ readOutputMode: "preview", readPreviewLines: 2 });
	expect(render(details, true).slice(3)).toEqual(["<a.ts>", "1   alpha", "… 6 more lines"]);
	settings({ readOutputMode: "summary" });
	expect(render(details, true)).toHaveLength(3);
	settings({ readOutputMode: "hidden" });
	expect(render(details, true)).toEqual([]);
});

test("image display follows the fork setting without duplicating Pi images", async () => {
	const { events, context, settings } = await fixture();
	settings({ showReadImages: "on" });
	setCapabilities({ images: "kitty", hyperlinks: true, trueColor: true });
	context.showImages = false;
	const request = {
		phase: "result",
		result: {
			content: [{ type: "image", mimeType: "image/png", data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=" }],
			details: { paths: ["image.png"], fileLineCounts: [1] },
		},
		options: { expanded: false, isPartial: false }, theme, context,
		component: undefined as Component | undefined,
	};
	function hasImage(): boolean {
		events.emit("gilad:read-many-files:render", request);
		return request.component!.render(120).some((line) => line.includes("\x1b_G"));
	}
	expect(hasImage()).toBe(false);
	request.options.expanded = true;
	expect(hasImage()).toBe(true);
	context.showImages = true;
	expect(hasImage()).toBe(false);
});

test("pending call stays compact and partial results add no duplicate row", async () => {
	const { cwd, events, context } = await fixture();
	const call = { phase: "call", args: context.args, theme, context: { ...context, isPartial: true }, component: undefined as Component | undefined };
	events.emit("gilad:read-many-files:render", call);
	expect(call.component!.render(120).map(stripAnsi)).toEqual(["● Reading 2 files…"]);
	const result = {
		phase: "result", result: { content }, options: { expanded: false, isPartial: true },
		theme, context: { ...context, cwd }, component: undefined as Component | undefined,
	};
	events.emit("gilad:read-many-files:render", result);
	expect(result.component!.render(120)).toEqual([]);
});
