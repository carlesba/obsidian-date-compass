import type { Moment } from "moment";
import type { Setting } from "obsidian";
import { t } from "../i18n/index.ts";

export interface SampleHost {
	today: () => Moment;
	write: (key: string, value: unknown) => void;
}

export function todayIn(format: string, today: Moment): string {
	return t("todaySample", { date: today.format(format) });
}

export interface TodaySample {
	show: (text: string) => void;
	remove: () => void;
}

export function addTodaySample(setting: Setting, text: string): TodaySample {
	const sample = setting.infoEl.createDiv({ cls: "setting-item-description date-compass-today-sample", text });
	return { show: (next) => sample.setText(next), remove: () => sample.remove() };
}
