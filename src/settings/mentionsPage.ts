import type { SettingDefinitionList, SettingDefinitionRender } from "obsidian";
import { t } from "../i18n/index.ts";
import { clashWarning } from "../mentions/clashes.ts";
import type { TriggerClash } from "../mentions/clashes.ts";
import { DEFAULT_MENTION_TRIGGER, newMention } from "../mentions/settings.ts";
import type { Mention } from "../mentions/settings.ts";
import { mentionKey, mentionKeyPrefix, triggerError } from "./controlKeys.ts";
import { moveEntry } from "./entryList.ts";
import { linkStyleItems, targetNames } from "./linkStylePage.ts";
import type { LinkStyleHost } from "./linkStylePage.ts";
import { LIST_ROW_EDIT_CLASS, leadWithListControls } from "./listRow.ts";
import type { IdentifiedPage } from "./pages.ts";

export interface MentionsPageContext extends LinkStyleHost {
	mentions: () => Mention[];
	clashesOf: (mention: Mention) => TriggerClash[];
	openPage: (pageId: string) => void;
	change: (mutate: () => unknown) => Promise<void>;
}

export const MENTIONS_PAGE_ID = "mentions";

export function mentionPageId(mention: Mention): string {
	return `mention-${mention.id}`;
}

export function mentionsPage(context: MentionsPageContext): IdentifiedPage {
	const mentions = context.mentions();
	return {
		type: "page",
		id: MENTIONS_PAGE_ID,
		name: t("mentionsSection"),
		desc: t("mentionsSectionDesc"),
		items: [mentionsList(mentions, context), { type: "group", visible: false, items: mentions.map((mention) => mentionPage(mention, context)) }],
	};
}

function mentionsList(mentions: Mention[], context: MentionsPageContext): SettingDefinitionList {
	return {
		type: "list",
		heading: t("mentionsList"),
		emptyState: t("noMentionsYet"),
		items: mentions.map((mention) => mentionRow(mention, context)),
		onReorder: (from, to) => void context.change(() => moveEntry(mentions, from, to)),
		onDelete: (index) => void context.change(() => mentions.splice(index, 1)),
		addItem: {
			name: t("addMention"),
			action: () => {
				const mention = newMention(mentions);
				void context.change(() => mentions.push(mention)).then(() => context.openPage(mentionPageId(mention)));
			},
		},
	};
}

export function mentionSummary(mention: Mention, clashes: readonly TriggerClash[]): string {
	const warning = clashWarning(clashes);
	const targets = targetNames(mention.targets);
	return warning ? `${targets}. ${warning}` : targets;
}

function mentionRow(mention: Mention, context: MentionsPageContext): SettingDefinitionRender {
	const summary = () => mentionSummary(mention, context.clashesOf(mention));
	return {
		name: mention.trigger,
		desc: summary(),
		render: (setting) => {
			setting.setName(mention.trigger);
			setting.setDesc(summary());
			setting.addExtraButton((button) =>
				button
					.setIcon("pencil")
					.setTooltip(t("editMention"))
					.onClick(() => context.openPage(mentionPageId(mention)))
					.extraSettingsEl.addClass(LIST_ROW_EDIT_CLASS),
			);
			return leadWithListControls(setting);
		},
	};
}

function mentionPage(mention: Mention, context: MentionsPageContext): IdentifiedPage {
	const warning = clashWarning(context.clashesOf(mention));
	return {
		type: "page",
		id: mentionPageId(mention),
		get name() {
			return mention.trigger;
		},
		status: () => (context.clashesOf(mention).length > 0 ? "warning" : null),
		items: [
			{
				type: "group",
				items: [
					{
						name: t("mentionTrigger"),
						desc: t("mentionTriggerDesc"),
						control: { type: "text", key: mentionKey(mention.id, "trigger"), placeholder: DEFAULT_MENTION_TRIGGER, validate: triggerError },
					},
					...(warning ? [{ name: t("triggerClashTitle"), desc: warning }] : []),
				],
			},
			...linkStyleItems({ keyPrefix: mentionKeyPrefix(mention.id), style: () => mention, host: context }),
		],
	};
}
