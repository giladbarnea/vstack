import type { ExtensionAPI, Theme, ToolRenderContext, ToolRenderResultOptions } from "@earendil-works/pi-coding-agent";
import type { Component } from "@earendil-works/pi-tui";

import { renderReadImages } from "./tool-renderer/images.js";
import { readOutputMode, settingNumber } from "./tool-renderer/settings.js";
import { stackPrefix, treeConnector } from "./tool-renderer/theme.js";
import { clearBlink, makeEmpty, makeTruncatedLines, pendingStatusPrefix, plural, preview, readCallText, splitTerminalLines } from "./tool-renderer/text.js";

type ReadManyFilesArguments = { paths?: string[] };
type ReadManyFilesContext = ToolRenderContext<Record<string, unknown>, ReadManyFilesArguments>;

interface ReadManyFilesResult {
	content: ({ type: "text"; text: string } | { type: "image"; data: string; mimeType: string })[];
	details?: {
		paths?: string[];
		hiddenIndexes?: number[];
		hiddenPaths?: string[];
		fileLineCounts?: number[];
		failedIndexes?: number[];
	};
}

type RenderRequest = {
	theme: Theme;
	context: ReadManyFilesContext;
	component?: Component;
} & ({ phase: "call"; args: ReadManyFilesArguments } | {
	phase: "result";
	result: ReadManyFilesResult;
	options: ToolRenderResultOptions;
});

function renderResult(result: ReadManyFilesResult, options: ToolRenderResultOptions, theme: Theme, context: ReadManyFilesContext): Component {
	const { cwd } = context;
	const { expanded, isPartial } = options;
	if (isPartial) return makeEmpty();
	clearBlink(context);
	const mode = readOutputMode(cwd);
	if (mode === "hidden") return renderReadImages(makeEmpty(), result, expanded, theme, context, cwd);
	const details = result.details;
	const paths = details?.paths ?? context.args.paths ?? [];
	const hiddenIndexes = new Set(details?.hiddenIndexes);
	const hiddenPaths = new Set(details?.hiddenPaths);
	const failedIndexes = new Set(details?.failedIndexes);
	const failed = context.isError || failedIndexes.size > 0;
	let text = `${stackPrefix(theme, cwd)}Read ${plural(paths.length, "file")}${theme.fg(failed ? "error" : "success", failed ? " · failed" : " · done")}`;
	paths.forEach((path, index) => {
		const hidden = details?.hiddenIndexes !== undefined ? hiddenIndexes.has(index) : hiddenPaths.has(path);
		const status = context.isError || failedIndexes.has(index)
			? theme.fg("error", "failed")
			: hidden ? theme.fg("muted", "unchanged") : theme.fg("success", plural(details?.fileLineCounts?.[index] ?? 0, "line"));
		text += `\n${treeConnector(theme, index === paths.length - 1 ? "└" : "├", cwd)}${readCallText({ path: path.replace(/^@/, "") }, theme, cwd)}${theme.fg("dim", " · ")}${status}`;
	});
	if (expanded && mode === "preview") {
		const content = result.content.filter((part) => part.type === "text").map((part) => part.text).join("\n\n");
		const limit = Math.max(1, Math.floor(settingNumber("readPreviewLines", 80, cwd)));
		const lines = splitTerminalLines(content);
		if (content) text += `\n${theme.fg("dim", preview(content, limit, "head", cwd))}`;
		if (lines.length > limit) text += `\n${theme.fg("muted", `… ${plural(lines.length - limit, "more line")}`)}`;
	}
	return renderReadImages(makeTruncatedLines(text), result, expanded, theme, context, cwd);
}

export function registerReadManyFilesRenderer(pi: ExtensionAPI): void {
	const unsubscribe = pi.events.on("gilad:read-many-files:render", (data: unknown) => {
		const request = data as RenderRequest;
		const { theme, context } = request;
		request.component = request.phase === "result"
			? renderResult(request.result, request.options, theme, context)
			: context.isPartial
				? makeTruncatedLines(`${pendingStatusPrefix(theme, context, context.cwd)}Reading ${plural(request.args.paths?.length ?? 0, "file")}…`)
				: makeEmpty();
	});
	pi.on("session_shutdown", unsubscribe);
}
