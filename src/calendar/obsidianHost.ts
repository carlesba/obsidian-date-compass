import { getAllTags, moment } from "obsidian";
import type { App, TFile } from "obsidian";
import type { Moment } from "moment";
import type { CivilDate } from "../parse/calendar.ts";
import { backlinkIndex, dotsOfDecorators, matchesFilters } from "./decorators.ts";
import type { BacklinkIndex, Dot, DotDecorator, DotPlace, LinkingNote } from "./decorators.ts";
import { countWords, openTaskCount, wordCountCache } from "./dots.ts";
import { firstDayOf } from "./grid.ts";
import type { CivilMonth } from "./grid.ts";
import type { WeekRule } from "./weeks.ts";

export interface NoteDotsReader {
	dotsOf(path: string, place: DotPlace, hasNote: boolean, decorators: readonly DotDecorator[]): Dot[];
	linksChanged(): void;
}

interface PluginRegistry {
	plugins?: { enabledPlugins?: ReadonlySet<string> };
}

export function enabledPluginIds(app: App): ReadonlySet<string> {
	try {
		return (app as App & PluginRegistry).plugins?.enabledPlugins ?? new Set<string>();
	} catch {
		return new Set<string>();
	}
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
	let backlinks: BacklinkIndex | undefined;
	const backlinksNow = (): BacklinkIndex => {
		backlinks ??= backlinkIndex({ resolved: app.metadataCache.resolvedLinks, unresolved: app.metadataCache.unresolvedLinks });
		return backlinks;
	};
	const linkingNoteOf = (path: string): LinkingNote => {
		const cache = app.metadataCache.getCache(path);
		return { path, tags: cache ? (getAllTags(cache) ?? []) : [], frontmatter: cache?.frontmatter };
	};
	const wordsOf = (file: TFile): number => {
		const counted = counts.get(file.path, file.stat.mtime);
		if (counted === undefined) countWordsOf(file).catch(() => undefined);
		return counted ?? 0;
	};
	return {
		dotsOf: (path, place, hasNote, decorators) => {
			const file = hasNote ? app.vault.getFileByPath(path) : null;
			let linkingNotes: LinkingNote[] | undefined;
			return dotsOfDecorators(decorators, place, file !== null, (decorator) => {
				switch (decorator.source) {
					case "words":
						return file ? wordsOf(file) : 0;
					case "openTasks":
						return file ? openTaskCount(app.metadataCache.getFileCache(file)?.listItems) : 0;
					case "links":
						linkingNotes ??= backlinksNow().sourcesOf(path).map(linkingNoteOf);
						return linkingNotes.filter((note) => matchesFilters(note, decorator.filters)).length;
				}
			});
		},
		linksChanged: () => {
			backlinks = undefined;
		},
	};
}
