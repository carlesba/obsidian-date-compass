import type { SettingDefinitionGroup } from "obsidian";
import { t, translatedLabels } from "../i18n/index.ts";
import type { TranslationKey } from "../i18n/index.ts";
import { LINK_PLACEHOLDER } from "../sequence/settings.ts";
import type { SequenceLayout } from "../sequence/settings.ts";
import { SEQUENCE_ITEM_TEMPLATE_KEY, SEQUENCE_LAYOUT_KEY, itemTemplateError } from "./controlKeys.ts";

const LAYOUT_LABELS: Record<SequenceLayout, TranslationKey> = {
	inline: "layoutInline",
	bulletList: "layoutBulletList",
	linePerItem: "layoutLinePerItem",
};

export function insertSequenceGroups(): SettingDefinitionGroup[] {
	return [
		{
			type: "group",
			items: [
				{
					name: t("sequenceLayout"),
					desc: t("sequenceLayoutDesc"),
					control: { type: "dropdown", key: SEQUENCE_LAYOUT_KEY, options: translatedLabels(LAYOUT_LABELS) },
				},
				{
					name: t("itemTemplate"),
					desc: t("itemTemplateDesc"),
					control: { type: "text", key: SEQUENCE_ITEM_TEMPLATE_KEY, placeholder: LINK_PLACEHOLDER, validate: itemTemplateError },
				},
			],
		},
	];
}
