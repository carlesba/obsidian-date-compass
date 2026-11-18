import { isRecord } from "../dateNotes/periods.ts";

export interface CalendarSettings {
	showWeekNumbers: boolean;
	confirmBeforeCreate: boolean;
	wordsPerDot: number;
}

export const DEFAULT_WORDS_PER_DOT = 250;

export function isWordsPerDot(value: unknown): value is number {
	return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

export function defaultCalendar(): CalendarSettings {
	return mergeCalendar(undefined);
}

export function mergeCalendar(stored: unknown): CalendarSettings {
	const data = isRecord(stored) ? stored : {};
	return {
		showWeekNumbers: typeof data.showWeekNumbers === "boolean" ? data.showWeekNumbers : true,
		confirmBeforeCreate: typeof data.confirmBeforeCreate === "boolean" ? data.confirmBeforeCreate : true,
		wordsPerDot: isWordsPerDot(data.wordsPerDot) ? data.wordsPerDot : DEFAULT_WORDS_PER_DOT,
	};
}
