import { getLinkpath, moment } from "obsidian";
import type { App, TFile } from "obsidian";
import type { Moment } from "moment";
import type { CivilDate } from "../parse/calendar.ts";
import { backlinkIndex, dotsOfDecorators, linkReachesTarget, linkedFromPlaces, linkingNoteMatcher, propertyOfFrontmatterKey } from "./decorators.ts";
import type { BacklinkIndex, Dot, DotDecorator, DotPlace, LinkLocation } from "./decorators.ts";
import { createFilterVault, propertyTypesOf } from "../filters/obsidianVault.ts";
import type { VaultNote } from "../filters/vault.ts";
import { FIXED_DATE_FORMAT } from "../filters/conditions.ts";
import { countWords, openTaskCount, wordCountCache } from "./dots.ts";
import { firstDayOf } from "./grid.ts";
import type { CivilMonth } from "./grid.ts";
import type { WeekRule } from "./weeks.ts";

export interface NoteDotsReader {
	dotsOf(path: string, place: DotPlace, hasNote: boolean, decorators: readonly DotDecorator[]): Dot[];
	linksChanged(): void;
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
	const vault = createFilterVault(app);
	const linkingNoteOf = (path: string): VaultNote[] => {
		const file = app.vault.getFileByPath(path);
		return file ? [{ path, basename: file.basename, ctime: file.stat.ctime }] : [];
	};
	let matchers = new Map<string, (note: VaultNote) => boolean>();
	const matcherOf = (decorator: DotDecorator): ((note: VaultNote) => boolean) => {
		const today = moment();
		const { filter, legacyFilters, unreadableFilter } = decorator;
		const compiledFor = JSON.stringify([today.format(FIXED_DATE_FORMAT), filter, legacyFilters, unreadableFilter !== undefined]);
		const compiled = matchers.get(compiledFor) ?? linkingNoteMatcher(decorator, { vault, propertyTypes: propertyTypesOf(app), today });
		matchers.set(compiledFor, compiled);
		return compiled;
	};
	const linkLocationsOf = (sourcePath: string, targetPath: string): LinkLocation[] => {
		const file = app.vault.getFileByPath(sourcePath);
		const cache = file ? app.metadataCache.getFileCache(file) : null;
		if (!cache) return [];
		const reachesTarget = (link: string): boolean => {
			const linkpath = getLinkpath(link);
			return linkReachesTarget(targetPath, linkpath, app.metadataCache.getFirstLinkpathDest(linkpath, sourcePath)?.path);
		};
		const body = [...(cache.links ?? []), ...(cache.embeds ?? [])].filter((link) => reachesTarget(link.link)).map((): LinkLocation => ({}));
		const properties = (cache.frontmatterLinks ?? []).filter((link) => reachesTarget(link.link)).map((link): LinkLocation => ({ property: propertyOfFrontmatterKey(link.key) }));
		return [...body, ...properties];
	};
	const wordsOf = (file: TFile): number => {
		const counted = counts.get(file.path, file.stat.mtime);
		if (counted === undefined) countWordsOf(file).catch(() => undefined);
		return counted ?? 0;
	};
	return {
		dotsOf: (path, place, hasNote, decorators) => {
			const file = hasNote ? app.vault.getFileByPath(path) : null;
			let linkingNotes: VaultNote[] | undefined;
			const locations = new Map<string, LinkLocation[]>();
			const locationsOf = (sourcePath: string): LinkLocation[] => {
				const found = locations.get(sourcePath) ?? linkLocationsOf(sourcePath, path);
				locations.set(sourcePath, found);
				return found;
			};
			return dotsOfDecorators(decorators, place, file !== null, (decorator) => {
				switch (decorator.source) {
					case "words":
						return file ? wordsOf(file) : 0;
					case "openTasks":
						return file ? openTaskCount(app.metadataCache.getFileCache(file)?.listItems) : 0;
					case "links":
						linkingNotes ??= backlinksNow().sourcesOf(path).flatMap(linkingNoteOf);
						return countLinkingNotes(linkingNotes, decorator, matcherOf(decorator), locationsOf);
				}
			});
		},
		linksChanged: () => {
			backlinks = undefined;
			matchers = new Map();
		},
	};
}

function countLinkingNotes(notes: readonly VaultNote[], decorator: DotDecorator, matches: (note: VaultNote) => boolean, locationsOf: (path: string) => LinkLocation[]): number {
	const { linkPlaces } = decorator;
	return notes.filter((note) => matches(note) && (linkPlaces.length === 0 || linkedFromPlaces(linkPlaces, locationsOf(note.path)))).length;
}
