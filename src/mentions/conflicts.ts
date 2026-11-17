import { isRecord } from "../dateNotes/periods.ts";

export interface EnabledPlugin {
	id: string;
	name: string;
	settings: unknown;
}

type TriggerReader = (settings: Record<string, unknown>) => unknown[];

const NLDATES_TRIGGERS: TriggerReader = (settings) =>
	settings.isAutosuggestEnabled === false ? [] : [settings.autocompleteTriggerPhrase ?? "@"];

const TRIGGER_READERS: Record<string, TriggerReader> = {
	"nldates-obsidian": NLDATES_TRIGGERS,
	"nldates-revived": NLDATES_TRIGGERS,
	"date-list": (settings) => [settings.suggestTrigger ?? "@", settings.listSuggestTrigger],
	"note-compass": (settings) => {
		const mention = isRecord(settings.mention) ? settings.mention : {};
		return mention.enabled === true ? [mention.trigger] : [];
	},
};

export function sameTriggerPlugins(trigger: string, plugins: readonly EnabledPlugin[]): string[] {
	if (trigger === "") return [];
	return plugins
		.filter(({ id, settings }) => {
			const read = TRIGGER_READERS[id];
			return read !== undefined && read(isRecord(settings) ? settings : {}).some((theirs) => theirs === trigger);
		})
		.map(({ name }) => name);
}

export const PLUGINS_WITH_TRIGGERS = Object.keys(TRIGGER_READERS);
