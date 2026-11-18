import type { TranslationKey } from "../i18n/index.ts";
import type { Period } from "./periods.ts";

export interface ListedCommand {
	id: string;
	name: TranslationKey;
	icon: string;
}

export const CURRENT_PERIOD_COMMANDS: Record<Period, ListedCommand> = {
	day: { id: "open-today", name: "openTodayNote", icon: "calendar-check" },
	week: { id: "open-this-week", name: "openThisWeekNote", icon: "calendar-range" },
	month: { id: "open-this-month", name: "openThisMonthNote", icon: "calendar" },
	quarter: { id: "open-this-quarter", name: "openThisQuarterNote", icon: "calendar-fold" },
	year: { id: "open-this-year", name: "openThisYearNote", icon: "calendar-clock" },
};

export const NEXT_PERIOD_COMMANDS: Record<Period, ListedCommand> = {
	day: { id: "open-tomorrow", name: "openTomorrowNote", icon: "sunrise" },
	week: { id: "open-next-week", name: "openNextWeekNote", icon: "calendar-arrow-up" },
	month: { id: "open-next-month", name: "openNextMonthNote", icon: "calendar-plus" },
	quarter: { id: "open-next-quarter", name: "openNextQuarterNote", icon: "calendar-plus-2" },
	year: { id: "open-next-year", name: "openNextYearNote", icon: "calendar-sync" },
};

export const NEXT_DATE_NOTE_COMMAND: ListedCommand = { id: "open-next-date-note", name: "openNextDateNote", icon: "square-chevron-right" };

export const PREVIOUS_DATE_NOTE_COMMAND: ListedCommand = { id: "open-previous-date-note", name: "openPreviousDateNote", icon: "square-chevron-left" };

export const OPEN_BY_PHRASE_COMMAND: ListedCommand = { id: "open-date-note-by-phrase", name: "openDateNoteByPhrase", icon: "calendar-search" };
