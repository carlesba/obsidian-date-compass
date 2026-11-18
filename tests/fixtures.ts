import { presetCommands } from "../src/commands/settings.ts";
import type { DateCommand } from "../src/commands/settings.ts";
import { PERIODS, defaultDateNotes } from "../src/dateNotes/periods.ts";
import type { DateNotesSettings, Period } from "../src/dateNotes/periods.ts";
import { defaultLinkStyle } from "../src/insertion/linkStyle.ts";
import { defaultSettings } from "../src/settings.ts";
import type { DateCompassSettings } from "../src/settings.ts";

export function dateNotesEnabling(enabled: readonly Period[]): DateNotesSettings {
	const dateNotes = defaultDateNotes();
	for (const period of PERIODS) dateNotes.periods[period].enabled = enabled.includes(period);
	return dateNotes;
}

export function dateNotesWithoutQuarter(): DateNotesSettings {
	return dateNotesEnabling(["day", "week", "month", "year"]);
}

export function propertyCommand(id: string, name: string, property: string): DateCommand {
	return { ...defaultLinkStyle(), id, name, destination: "property", property, mode: "add", asks: "dates", link: true };
}

export function cursorAndPropertyCommands(): DateCommand[] {
	return [...presetCommands(), propertyCommand("set-dates", "Add dates", "dates"), propertyCommand("set-reminders", "Set reminders", "reminders")];
}

export function settingsWithPropertyCommands(): DateCompassSettings {
	const settings = defaultSettings();
	settings.commands = cursorAndPropertyCommands();
	return settings;
}
