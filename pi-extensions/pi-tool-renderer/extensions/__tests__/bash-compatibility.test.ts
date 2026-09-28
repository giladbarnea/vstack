import { beforeAll, expect, test } from "bun:test";
import * as agent from "@earendil-works/pi-coding-agent";
import type { ExtensionAPI, ExtensionContext, Theme, ToolDefinition } from "@earendil-works/pi-coding-agent";
import { registerBash } from "../tool-renderer/tools.js";

const definitions = new Map<string, ToolDefinition>();
const context = {
	cwd: process.cwd(),
	sessionManager: { getSessionId: () => "renderer-session", getSessionFile: () => undefined },
} as ExtensionContext;
const theme = { fg: (_color: string, text: string) => text, bold: (text: string) => text } as Theme;
let bash: ToolDefinition;

beforeAll(() => {
	registerBash({ registerTool: (definition: ToolDefinition) => definitions.set(definition.name, definition) } as ExtensionAPI, agent, context.cwd);
	bash = definitions.get("bash")!;
});

function render(text: string, isError: boolean): string {
	return bash.renderResult!(
		{ content: [{ type: "text", text }], details: undefined },
		{ expanded: false, isPartial: false },
		theme,
		{ args: { command: "probe" }, cwd: context.cwd, state: {}, isError, toolCallId: "probe",
			executionStarted: true, argsComplete: true, isPartial: false, expanded: false, showImages: false, invalidate() {} },
	).render(100).join("\n");
}

test("Bash receives current Pi session metadata", async () => {
	const result = await bash.execute("metadata", { command: 'printf "%s" "$PI_SESSION_ID"' }, undefined, undefined, context);
	expect(result.content).toEqual([{ type: "text", text: "renderer-session" }]);
});

test("a failed command displays its actual exit status", async () => {
	let failure: unknown;
	try {
		await bash.execute("failure", { command: "exit 23" }, undefined, undefined, context);
	} catch (error) {
		failure = error;
	}
	expect(failure).toBeInstanceOf(Error);
	const rendered = render((failure as Error).message, true);
	expect(rendered).toContain("exit 23");
	expect(rendered).not.toContain("exit 0");
});

test("ordinary output cannot turn success into a failure", () => {
	expect(render("the manual says exit 99", false)).toContain("exit 0");
});

test("cancellation and timeout do not display a successful exit", () => {
	for (const output of ["Command aborted", "Command timed out after 1 seconds"]) {
		expect(render(output, true)).toContain("failed");
		expect(render(output, true)).not.toContain("exit 0");
	}
});
