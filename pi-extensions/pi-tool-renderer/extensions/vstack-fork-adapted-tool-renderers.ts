import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { openQuickSettings } from "../../pi-extension-manager/extensions/manager/quick-settings-ui.js";
import { CONFIG_ID, recordProjectTrust, settingBoolean } from "./tool-renderer/settings.js";
import { registerStackEvents } from "./tool-renderer/stack.js";
import { registerBash, registerEdit, registerRead, registerReadOnly, registerWrite } from "./tool-renderer/tools.js";

const INSTALL_SYMBOL = Symbol.for("gilad.vstack-fork-adapted-tool-renderers.installed");

export default async function vstackForkAdaptedToolRenderers(pi: ExtensionAPI): Promise<void> {
	const guard = pi as unknown as Record<PropertyKey, unknown>;
	if (guard[INSTALL_SYMBOL]) return;
	guard[INSTALL_SYMBOL] = true;
	pi.registerCommand("extensions:settings", {
		description: "Open the renderer settings dialog",
		handler: async (_args, ctx) => openQuickSettings(pi, ctx, CONFIG_ID),
	});
	if (!settingBoolean("enabled", true)) return;
	pi.on("session_start", (_event, ctx) => recordProjectTrust(ctx));
	registerStackEvents(pi);

	const agent = await import("@earendil-works/pi-coding-agent");
	const cwd = process.cwd();
	registerRead(pi, cwd);
	registerBash(pi, cwd);
	if (settingBoolean("renderMutationTools", false, cwd)) {
		registerEdit(pi, agent, cwd);
		registerWrite(pi, agent, cwd);
	}
	registerReadOnly(pi, cwd, "grep");
	registerReadOnly(pi, cwd, "find");
	registerReadOnly(pi, cwd, "ls");
}
