import { moment } from "obsidian";
import type { ParseOptions } from "./parse/index.ts";
import { parseOptionsOf } from "./parseOptions.ts";
import type { DateCompassSettings } from "./settings.ts";

export function localeParseOptions(settings: DateCompassSettings): ParseOptions {
	return parseOptionsOf(settings, moment.localeData().firstDayOfWeek());
}
