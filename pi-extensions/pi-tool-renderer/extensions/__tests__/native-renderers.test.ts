import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
	createAgentSession, createBashTool, createFindTool, createGrepTool, createLsTool, createReadTool,
	DefaultResourceLoader, defineTool, initTheme, SessionManager, SettingsManager, ToolExecutionComponent,
} from "@earendil-works/pi-coding-agent";
import type { TUI } from "@earendil-works/pi-tui";

const repository = resolve(import.meta.dir, "../../../..");
const originalAgentDir = process.env.PI_CODING_AGENT_DIR;
const originalNativeImports = process.env.JITI_TRY_NATIVE;
let directory: string;

beforeEach(() => {
	directory = mkdtempSync(join(tmpdir(), "native-renderers-"));
	process.env.PI_CODING_AGENT_DIR = directory;
	process.env.JITI_TRY_NATIVE = "0";
});

afterEach(() => {
	if (originalAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
	else process.env.PI_CODING_AGENT_DIR = originalAgentDir;
	if (originalNativeImports === undefined) delete process.env.JITI_TRY_NATIVE;
	else process.env.JITI_TRY_NATIVE = originalNativeImports;
	rmSync(directory, { recursive: true, force: true });
});

test("the fork changes rendering without conflicting with the tool owner", async () => {
	const ownedTools = [
		defineTool({ ...createReadTool(directory) }),
		defineTool({ ...createBashTool(directory) }),
		defineTool({ ...createGrepTool(directory) }),
		defineTool({ ...createFindTool(directory) }),
		defineTool({ ...createLsTool(directory) }),
	];
	const settingsManager = SettingsManager.inMemory({ packages: [repository] });
	const loader = new DefaultResourceLoader({
		cwd: directory, agentDir: directory, settingsManager,
		noContextFiles: true, noSkills: true, noThemes: true, noPromptTemplates: true,
		extensionFactories: [{ name: "tool-owner", factory: (pi) => {
			for (const tool of ownedTools) pi.registerTool(tool);
		} }],
	});
	await loader.reload();
	expect(loader.getExtensions().errors).toEqual([]);
	const { session } = await createAgentSession({
		cwd: directory, resourceLoader: loader, settingsManager, sessionManager: SessionManager.inMemory(),
	});
	try {
		for (const tool of ownedTools) {
			expect(session.getToolDefinition(tool.name)).toBe(tool);
			const renderer = session.extensionRunner.resolveToolRenderers(tool.name, () => tool);
			expect(renderer?.renderShell).toBe("self");
			expect(renderer?.renderResult).toBeFunction();
			expect(renderer?.renderResult).not.toBe(tool.renderResult);
		}
	} finally {
		session.dispose();
	}
});

for (const ownerFirst of [true, false]) {
	test(`a fresh session preserves tool contracts with ownerFirst=${ownerFirst}`, async () => {
		const ownerPath = join(directory, "tool-owner.ts");
		writeFileSync(ownerPath, `
			import { createBashTool, createReadTool, defineTool } from "@earendil-works/pi-coding-agent";
			export default function (pi) {
				pi.registerTool(defineTool({ ...createReadTool(process.cwd()) }));
				pi.registerTool(defineTool({ ...createBashTool(process.cwd()) }));
			}
		`);
		const rendererPath = join(repository, "pi-extensions/pi-tool-renderer/extensions/vstack-fork-adapted-tool-renderers.ts");
		const settingsManager = SettingsManager.inMemory({
			extensions: ownerFirst ? [ownerPath, rendererPath] : [rendererPath, ownerPath],
		});
		const loader = new DefaultResourceLoader({
			cwd: directory, agentDir: directory, settingsManager,
			noContextFiles: true, noSkills: true, noThemes: true, noPromptTemplates: true,
		});
		await loader.reload();
		const resources = loader.getExtensions();
		expect(resources.errors).toEqual([]);
		const owner = resources.extensions.find((extension) => extension.resolvedPath === ownerPath)!;
		const { session } = await createAgentSession({
			cwd: directory, resourceLoader: loader, settingsManager, sessionManager: SessionManager.inMemory(),
		});
		try {
			for (const { definition } of owner.tools.values()) {
				expect(session.getToolDefinition(definition.name)).toBe(definition);
			}
			const bashTool = session.agent.state.tools.find((tool) => tool.name === "bash")!;
			const bash = await bashTool.execute("probe/bash", { command: 'printf "%s" "$PI_SESSION_ID"' });
			expect(bash.structuredContent).toMatchObject({
				output: session.sessionManager.getSessionId(), exit_code: 0,
			});
			writeFileSync(join(directory, "fixture.txt"), "first line\nsecond line\nthird line\n");
			const readTool = session.agent.state.tools.find((tool) => tool.name === "read")!;
			const read = await readTool.execute("probe/read", { path: "fixture.txt" });
			initTheme("dark", false);
			const renderer = session.extensionRunner.resolveToolRenderers("read", () => session.getToolDefinition("read"));
			const component = new ToolExecutionComponent("read", "probe/read", { path: "fixture.txt" },
				{ showImages: false }, renderer, { requestRender() {} } as TUI, directory);
			component.markExecutionStarted();
			component.setArgsComplete();
			component.updateResult({ ...read, isError: false });
			const collapsed = component.render(100).join("\n");
			expect(collapsed).toContain("3 lines");
			expect(collapsed).not.toContain("second line");
			component.setExpanded(true);
			expect(component.render(100).join("\n")).toContain("second line");
			const fallback = session.extensionRunner.resolveToolRenderers("other", () => undefined);
			expect(fallback).toBeUndefined();
		} finally {
			session.dispose();
		}
	});
}
