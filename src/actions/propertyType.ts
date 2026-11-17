import type { App } from "obsidian";

export function propertyWidgetOf(app: App, name: string): string | undefined {
	try {
		const registry = (app as unknown as { metadataTypeManager?: { getAssignedWidget?: (name: string) => unknown; properties?: Record<string, { widget?: unknown; type?: unknown }> } }).metadataTypeManager;
		const assigned = registry?.getAssignedWidget?.(name);
		if (typeof assigned === "string") return assigned;
		const info = registry?.properties?.[name.toLowerCase()];
		const widget = info?.widget ?? info?.type;
		return typeof widget === "string" ? widget : undefined;
	} catch {
		return undefined;
	}
}
