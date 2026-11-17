import { isRecord } from "../dateNotes/periods.ts";

export const LINK_PLACEHOLDER = "{{link}}";

export const SEQUENCE_LAYOUTS = ["inline", "bulletList", "linePerItem"] as const;
export type SequenceLayout = (typeof SEQUENCE_LAYOUTS)[number];

export interface SequenceSettings {
	layout: SequenceLayout;
	itemTemplate: string;
}

export function isItemTemplate(value: string): boolean {
	return value.includes(LINK_PLACEHOLDER);
}

export function mergeSequence(stored: unknown): SequenceSettings {
	const data = isRecord(stored) ? stored : {};
	return {
		layout: SEQUENCE_LAYOUTS.find((layout) => layout === data.layout) ?? "inline",
		itemTemplate: typeof data.itemTemplate === "string" && isItemTemplate(data.itemTemplate) ? data.itemTemplate : LINK_PLACEHOLDER,
	};
}
