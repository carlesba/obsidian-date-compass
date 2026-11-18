import { moment } from "obsidian";
import type { Period } from "./dateNotes/periods.ts";
import { obsidianMoment } from "./dateNotes/obsidianHost.ts";
import type { RowContext } from "./mentions/rows.ts";
import type { ParseOptions } from "./parse/index.ts";
import { parseOptionsOf } from "./parseOptions.ts";
import type { DateCompassSettings } from "./settings.ts";

export function localeParseOptions(settings: DateCompassSettings): ParseOptions {
	return parseOptionsOf(settings, moment.localeData().firstDayOfWeek());
}

export function obsidianRowContext(settings: DateCompassSettings, targets?: readonly Period[]): RowContext {
	return {
		now: obsidianMoment(),
		moment: obsidianMoment,
		options: localeParseOptions(settings),
		periods: settings.dateNotes.periods,
		targets,
	};
}
