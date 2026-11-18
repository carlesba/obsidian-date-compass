import { moment } from "obsidian";
import type { App, TFile } from "obsidian";
import type { Moment } from "moment";
import type { CivilDate } from "../parse/calendar.ts";
import { countWords, dotsOf, hasOpenTask, wordCountCache } from "./dots.ts";
import type { Dot } from "./dots.ts";
import { firstDayOf } from "./grid.ts";
import type { CivilMonth } from "./grid.ts";
import type { WeekRule } from "./weeks.ts";

export interface NoteDotsReader {
	dotsOfNote(path: string, wordsPerDot: number): Dot[];
}

export function localeWeekRule(): WeekRule {
	const locale = moment.localeData();
	return { firstDayOfWeek: locale.firstDayOfWeek(), firstDayOfYear: locale.firstDayOfYear() };
}

export function momentOf(date: CivilDate): Moment {
	return moment({ year: date.year, month: date.month - 1, day: date.day });
}

export function weekdayShortNames(): string[] {
	return moment.weekdaysShort();
}

export function monthShortName(month: CivilMonth): string {
	return momentOf(firstDayOf(month)).format("MMM");
}

export function createNoteDotsReader(app: App, wordsCounted: (path: string) => void): NoteDotsReader {
	const counts = wordCountCache();
	const reading = new Set<string>();
	const countWordsOf = async (file: TFile): Promise<void> => {
		const { mtime } = file.stat;
		const read = `${file.path}\n${mtime}`;
		if (reading.has(read)) return;
		reading.add(read);
		try {
			counts.set(file.path, mtime, countWords(await app.vault.cachedRead(file)));
			wordsCounted(file.path);
		} finally {
			reading.delete(read);
		}
	};
	return {
		dotsOfNote: (path, wordsPerDot) => {
			const file = app.vault.getFileByPath(path);
			if (!file) return [];
			const counted = wordsPerDot > 0 ? counts.get(path, file.stat.mtime) : 0;
			if (counted === undefined) countWordsOf(file).catch(() => undefined);
			return dotsOf({ words: counted ?? 0, hasOpenTask: hasOpenTask(app.metadataCache.getFileCache(file)?.listItems) }, wordsPerDot);
		},
	};
}
