import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
	createAgentSession, DefaultResourceLoader, SessionManager, SettingsManager,
	type ExtensionUIContext, type Theme,
} from "@earendil-works/pi-coding-agent";
import { getKeybindings, type TUI } from "@earendil-works/pi-tui";

const repository = resolve(import.meta.dir, "../../../..");
const configId = "@vanillagreen/pi-tool-renderer";
const originalAgentDir = process.env.PI_CODING_AGENT_DIR;
const originalNativeImports = process.env.JITI_TRY_NATIVE;
let directory: string;

beforeEach(() => {
	directory = mkdtempSync(join(tmpdir(), "curated-settings-"));
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

async function load(config: Record<string, unknown> = {}) {
	writeFileSync(join(directory, "settings.json"), JSON.stringify({
		packages: [repository], theme: "dark",
		vstack: { extensionManager: { config: { [configId]: config } } },
	}));
	const settingsManager = SettingsManager.inMemory({ packages: [repository] });
	const loader = new DefaultResourceLoader({
		cwd: directory, agentDir: directory, settingsManager, noContextFiles: true,
		noSkills: true, noThemes: true, noPromptTemplates: true,
	});
	await loader.reload();
	expect(loader.getExtensions().errors).toEqual([]);
	return { loader, settingsManager };
}

test("disabled renderers leave the settings command available for recovery", async () => {
	const { loader } = await load({ enabled: false });
	const extension = loader.getExtensions().extensions[0];
	expect([...extension.tools.keys()]).toEqual([]);
	expect([...extension.commands.keys()]).toEqual(["extensions:settings"]);
	expect([...extension.handlers.keys()]).toEqual([]);
});

test("edit and write wrappers are registered only after explicit opt-in", async () => {
	const { loader } = await load({ renderMutationTools: true });
	expect([...loader.getExtensions().extensions[0].tools.keys()].sort()).toEqual([
		"bash", "edit", "find", "grep", "ls", "read", "write",
	]);
});

test("the curated settings use upstream metadata and the renderer's existing config identity", () => {
	const manifest = JSON.parse(readFileSync(join(repository, "package.json"), "utf8"));
	const upstream = JSON.parse(readFileSync(join(repository, "pi-extensions/pi-tool-renderer/package.json"), "utf8"));
	const selected = new Set(["enabled", "renderMutationTools", "showReadImages", "stackToolCalls", "stackChildDisplay"]);
	expect(manifest.name).toBe(configId);
	expect(manifest.vstack.extensionManager.settings).toEqual(
		upstream.vstack.extensionManager.settings.filter((setting: { key: string }) => selected.has(setting.key)),
	);
	expect(manifest.vstack.extensionManager.settings).toHaveLength(5);
});

test("the real settings dialog saves opt-in under the renderer config and reload activates it", async () => {
	const { loader, settingsManager } = await load({ showReadImages: "on" });
	const { session } = await createAgentSession({
		cwd: directory, resourceLoader: loader, settingsManager, sessionManager: SessionManager.inMemory(),
	});
	const notifications: string[] = [];
	const theme = {
		fg: (_token: string, text: string) => text,
		bg: (_token: string, text: string) => text,
		bold: (text: string) => text,
		inverse: (text: string) => text,
	} as Theme;
	const custom: ExtensionUIContext["custom"] = async (factory) => {
		const component = await factory(
			{ terminal: { rows: 40 }, requestRender() {} } as TUI,
			theme, getKeybindings(), () => {},
		);
		expect(component.render(100).join("\n")).toContain("Render edits/writes compactly");
		for (const character of "Render edits/writes compactly") component.handleInput!(character);
		component.handleInput!("\r");
		return undefined as never;
	};
	try {
		session.extensionRunner.setUIContext({
			...session.extensionRunner.getUIContext(), custom,
			notify: (message) => notifications.push(message),
		});
		const command = session.extensionRunner.getCommand("extensions:settings")!;
		await command.handler("", session.extensionRunner.createCommandContext());
		const saved = JSON.parse(readFileSync(join(directory, "settings.json"), "utf8"));
		expect(saved.vstack.extensionManager.config[configId]).toEqual({ showReadImages: "on", renderMutationTools: true });
		expect(saved.theme).toBe("dark");
		expect(notifications.some((message) => message.includes("/reload"))).toBe(true);
		await loader.reload();
		expect([...loader.getExtensions().extensions[0].tools.keys()].sort()).toEqual([
			"bash", "edit", "find", "grep", "ls", "read", "write",
		]);
	} finally {
		session.dispose();
	}
});
