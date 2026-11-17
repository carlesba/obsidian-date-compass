import type { App } from "obsidian";
import { openDateNote } from "../dateNotes/commands.ts";
import { obsidianMoment } from "../dateNotes/obsidianHost.ts";
import { localeParseOptions } from "../obsidianParseOptions.ts";
import type { DateCompassSettings } from "../settings.ts";
import { createDateCompassApi } from "./index.ts";
import type { DateCompassApi } from "./index.ts";

export function createObsidianDateCompassApi(app: App, settings: () => DateCompassSettings): DateCompassApi {
	return createDateCompassApi({
		settings,
		parseOptions: () => localeParseOptions(settings()),
		moment: obsidianMoment,
		openDateNote: (date, period) => openDateNote(app, settings().dateNotes, date, period),
	});
}
