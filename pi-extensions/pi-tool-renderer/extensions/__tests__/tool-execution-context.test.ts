import { expect, test } from "bun:test";
import type { ExtensionAPI, ExtensionContext, ToolDefinition } from "@earendil-works/pi-coding-agent";
import { registerBash, registerEdit, registerRead, registerReadOnly, registerWrite } from "../tool-renderer/tools.js";
import { useWorld } from "./helpers/world.js";

const world = useWorld();
const registrations = [
	["read", registerRead],
	["bash", registerBash],
	["edit", registerEdit],
	["write", registerWrite],
	["grep", (pi: ExtensionAPI, host: object, cwd: string) => registerReadOnly(pi, host, cwd, "grep")],
	["find", (pi: ExtensionAPI, host: object, cwd: string) => registerReadOnly(pi, host, cwd, "find")],
	["ls", (pi: ExtensionAPI, host: object, cwd: string) => registerReadOnly(pi, host, cwd, "ls")],
] as const;

for (const [name, register] of registrations) {
	test(`${name} forwards the execution context without changing the other arguments`, async () => {
		let received: unknown[] = [];
		let definition: ToolDefinition | undefined;
		const original = {
			description: "fixture",
			parameters: {},
			execute: async (...arguments_: unknown[]) => {
				received = arguments_;
				return { content: [] };
			},
		};
		const host = {
			createReadTool: () => original, createBashTool: () => original,
			createEditTool: () => original, createWriteTool: () => original,
			createGrepTool: () => original, createFindTool: () => original, createLsTool: () => original,
		};
		register({ registerTool: (tool: ToolDefinition) => { definition = tool; } } as ExtensionAPI, host, world().cwd);
		expect(definition).toBeDefined();
		const input = {};
		const signal = new AbortController().signal;
		const onUpdate = () => {};
		const context = { cwd: world().cwd } as ExtensionContext;
		await definition!.execute("call", input, signal, onUpdate, context);
		expect(received).toEqual(["call", input, signal, onUpdate, context]);
		expect(received[4]).toBe(context);
	});
}
