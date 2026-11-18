import { isRecord } from "../dateNotes/periods.ts";
import { t } from "../i18n/index.ts";
import type { TranslationKey } from "../i18n/index.ts";
import { sameTriggerPlugins } from "./conflicts.ts";
import type { EnabledPlugin } from "./conflicts.ts";

export const BUILTIN_FEATURES = ["links", "tags", "footnotes", "highlight", "slashCommands"] as const;
export type BuiltinFeature = (typeof BUILTIN_FEATURES)[number];

export const BUILTIN_SEQUENCES: Record<BuiltinFeature, string> = {
	links: "[[",
	tags: "#",
	footnotes: "[^",
	highlight: "==",
	slashCommands: "/",
};

export type TriggerClash =
	| { kind: "duplicate" }
	| { kind: "prefix"; trigger: string }
	| { kind: "builtin"; feature: BuiltinFeature; sequence: string }
	| { kind: "plugin"; name: string };

export interface TriggerOwner {
	id: string;
	trigger: string;
}

export function triggerClashes(mention: TriggerOwner, mentions: readonly TriggerOwner[], plugins: readonly EnabledPlugin[], slashCommandsEnabled: boolean | undefined): TriggerClash[] {
	const { trigger } = mention;
	if (trigger === "") return [];
	const others = mentions.filter((other) => other.id !== mention.id && other.trigger !== "").map((other) => other.trigger);
	const overlapping = others.filter((other, index) => other !== trigger && overlaps(trigger, other) && others.indexOf(other) === index);
	return [
		...(others.includes(trigger) ? [{ kind: "duplicate" as const }] : []),
		...overlapping.map((other) => ({ kind: "prefix" as const, trigger: other })),
		...BUILTIN_FEATURES.filter((feature) => feature !== "slashCommands" || slashCommandsEnabled === true)
			.filter((feature) => overlaps(trigger, BUILTIN_SEQUENCES[feature]))
			.map((feature) => ({ kind: "builtin" as const, feature, sequence: BUILTIN_SEQUENCES[feature] })),
		...sameTriggerPlugins(trigger, plugins).map((name) => ({ kind: "plugin" as const, name })),
	];
}

function overlaps(one: string, other: string): boolean {
	return one.startsWith(other) || other.startsWith(one);
}

const BUILTIN_FEATURE_NAMES: Record<BuiltinFeature, TranslationKey> = {
	links: "builtinLinks",
	tags: "builtinTags",
	footnotes: "builtinFootnotes",
	highlight: "builtinHighlight",
	slashCommands: "builtinSlashCommands",
};

export function clashText(clash: TriggerClash): string {
	switch (clash.kind) {
		case "duplicate":
			return t("clashDuplicate");
		case "prefix":
			return t("clashPrefix", { trigger: clash.trigger });
		case "builtin":
			return t("clashBuiltin", { feature: t(BUILTIN_FEATURE_NAMES[clash.feature]), sequence: clash.sequence });
		case "plugin":
			return t("clashPlugin", { plugin: clash.name });
	}
}

export function clashWarning(clashes: readonly TriggerClash[]): string | undefined {
	return clashes.length === 0 ? undefined : clashes.map(clashText).join(" ");
}

const SLASH_COMMANDS_PLUGIN_ID = "slash-command";

interface InternalPluginRegistry {
	getPluginById?: (id: string) => unknown;
	plugins?: unknown;
}

export function slashCommandsEnabledIn(internalPlugins: unknown): boolean | undefined {
	if (!isRecord(internalPlugins)) return undefined;
	const registry: InternalPluginRegistry = internalPlugins;
	const plugin = typeof registry.getPluginById === "function" ? registry.getPluginById(SLASH_COMMANDS_PLUGIN_ID) : pluginIn(registry.plugins);
	return isRecord(plugin) && typeof plugin.enabled === "boolean" ? plugin.enabled : undefined;
}

function pluginIn(plugins: unknown): unknown {
	return isRecord(plugins) ? plugins[SLASH_COMMANDS_PLUGIN_ID] : undefined;
}
