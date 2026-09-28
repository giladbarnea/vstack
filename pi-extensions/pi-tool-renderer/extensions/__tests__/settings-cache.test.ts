import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { glyphStyle } from "../tool-renderer/glyphs.js";
import { readVstackConfig, recordProjectTrust } from "../tool-renderer/settings.js";

const previousAgentDirectory = process.env.PI_CODING_AGENT_DIR;
let directory: string;
let project: string;
let settingsPath: string;

function writeSettings(path: string, config: Record<string, unknown>): void {
	writeFileSync(path, JSON.stringify({ vstack: { extensionManager: { config: { "@vanillagreen/pi-tool-renderer": config } } } }));
}

beforeEach(() => {
	directory = mkdtempSync(join(tmpdir(), "renderer-settings-"));
	project = join(directory, "project");
	mkdirSync(join(project, ".pi"), { recursive: true });
	settingsPath = join(directory, "settings.json");
	process.env.PI_CODING_AGENT_DIR = directory;
	writeSettings(settingsPath, { glyphStyle: "ascii", commandPreviewChars: 96 });
});

afterEach(() => {
	if (previousAgentDirectory === undefined) delete process.env.PI_CODING_AGENT_DIR;
	else process.env.PI_CODING_AGENT_DIR = previousAgentDirectory;
	rmSync(directory, { recursive: true, force: true });
});

test("unchanged settings reuse the merged configuration for glyphs and rendering", () => {
	const first = readVstackConfig(project);
	expect(glyphStyle(project)).toBe("ascii");
	expect(readVstackConfig(project)).toBe(first);
});

test("a same-size settings edit invalidates the cache", () => {
	const first = readVstackConfig(project);
	const timestamp = statSync(settingsPath).mtimeMs;
	writeSettings(settingsPath, { glyphStyle: "ascii", commandPreviewChars: 80 });
	utimesSync(settingsPath, new Date(timestamp + 1000), new Date(timestamp + 1000));
	expect(readVstackConfig(project).commandPreviewChars).toBe(80);
	expect(readVstackConfig(project)).not.toBe(first);
});

test("cached configuration respects project trust changes", () => {
	writeSettings(join(project, ".pi/settings.json"), { glyphStyle: "unicode" });
	expect(glyphStyle(project)).toBe("ascii");
	recordProjectTrust({ cwd: project, isProjectTrusted: () => true });
	expect(glyphStyle(project)).toBe("unicode");
	recordProjectTrust({ cwd: project, isProjectTrusted: () => false });
	expect(glyphStyle(project)).toBe("ascii");
});
