import type { CalendarSettings } from "./settings.ts";

export const ORIGINAL_CALENDAR_PLUGIN_ID = "calendar";
export const ORIGINAL_CALENDAR_ROOT_ID = "calendar-container";

export function rootIdOf(calendar: CalendarSettings): string | undefined {
	return calendar.themeCompatibility ? ORIGINAL_CALENDAR_ROOT_ID : undefined;
}

export function sharesRootIdWithOriginalCalendar(calendar: CalendarSettings, enabledPluginIds: ReadonlySet<string>): boolean {
	return rootIdOf(calendar) !== undefined && enabledPluginIds.has(ORIGINAL_CALENDAR_PLUGIN_ID);
}
