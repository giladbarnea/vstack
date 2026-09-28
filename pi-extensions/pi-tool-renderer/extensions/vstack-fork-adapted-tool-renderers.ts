import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { recordProjectTrust } from "./tool-renderer/settings.js";
import { registerStackEvents } from "./tool-renderer/stack.js";
import { registerBash, registerEdit, registerRead, registerReadOnly, registerWrite } from "./tool-renderer/tools.js";

const INSTALL_SYMBOL = Symbol.for("gilad.vstack-fork-adapted-tool-renderers.installed");

export default async function vstackForkAdaptedToolRenderers(pi: ExtensionAPI): Promise<void> {
	const guard = pi as unknown as Record<PropertyKey, unknown>;
	if (guard[INSTALL_SYMBOL]) return;
	guard[INSTALL_SYMBOL] = true;
	pi.on("session_start", (_event, ctx) => recordProjectTrust(ctx));
	registerStackEvents(pi);

	const agent = await import("@earendil-works/pi-coding-agent");
	const cwd = process.cwd();
	registerRead(pi, agent, cwd);
	registerBash(pi, agent, cwd);
	registerEdit(pi, agent, cwd);
	registerWrite(pi, agent, cwd);
	registerReadOnly(pi, agent, cwd, "grep");
	registerReadOnly(pi, agent, cwd, "find");
	registerReadOnly(pi, agent, cwd, "ls");
}
