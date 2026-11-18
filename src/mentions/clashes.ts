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
