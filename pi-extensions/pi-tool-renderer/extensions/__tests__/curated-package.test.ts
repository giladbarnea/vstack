import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DefaultResourceLoader, SettingsManager } from "@earendil-works/pi-coding-agent";

test("installing the fork exposes only the selected tool renderers", async () => {
	const directory = mkdtempSync(join(tmpdir(), "curated-package-"));
	const repository = resolve(import.meta.dir, "../../../..");
	const previousNativeImports = process.env.JITI_TRY_NATIVE;
	process.env.JITI_TRY_NATIVE = "0";
	try {
		const loader = new DefaultResourceLoader({
			cwd: directory,
			agentDir: directory,
			settingsManager: SettingsManager.inMemory({ packages: [repository] }),
			noContextFiles: true,
		});
		await loader.reload();
		const resources = loader.getExtensions();
		expect(resources.errors).toEqual([]);
		expect(resources.extensions).toHaveLength(1);
		expect([...resources.extensions[0].tools.keys()].sort()).toEqual(["bash", "find", "grep", "ls", "read"]);
		expect([...resources.extensions[0].commands.keys()]).toEqual(["extensions:settings"]);
		expect([...resources.extensions[0].handlers.keys()].sort()).toEqual(["agent_end", "agent_start", "session_shutdown", "session_start", "tool_execution_end", "tool_execution_start"]);
		expect(loader.getSkills().skills.filter((skill) => skill.filePath.startsWith(`${repository}/`))).toEqual([]);
		expect(loader.getPrompts().prompts).toEqual([]);
		expect(loader.getThemes().themes).toEqual([]);
	} finally {
		if (previousNativeImports === undefined) delete process.env.JITI_TRY_NATIVE;
		else process.env.JITI_TRY_NATIVE = previousNativeImports;
		rmSync(directory, { recursive: true, force: true });
	}
});
