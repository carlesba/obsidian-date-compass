import { isRecord } from "../dateNotes/periods.ts";
import { mergeDecorators } from "./decorators.ts";
import type { DotDecorator } from "./decorators.ts";

export interface CalendarSettings {
	showWeekNumbers: boolean;
	confirmBeforeCreate: boolean;
	dimWithoutNote: boolean;
	decorators: DotDecorator[];
}

export function defaultCalendar(): CalendarSettings {
	return mergeCalendar(undefined);
}

export function mergeCalendar(stored: unknown): CalendarSettings {
	const data = isRecord(stored) ? stored : {};
	return {
		showWeekNumbers: typeof data.showWeekNumbers === "boolean" ? data.showWeekNumbers : true,
		confirmBeforeCreate: typeof data.confirmBeforeCreate === "boolean" ? data.confirmBeforeCreate : true,
		dimWithoutNote: typeof data.dimWithoutNote === "boolean" ? data.dimWithoutNote : false,
		decorators: mergeDecorators(data.decorators, data.wordsPerDot),
	};
}
