import { addDays, daysBetween, daysInMonth, isValidDate, isoDate } from "../parse/calendar.ts";
import type { CivilMonth } from "./grid.ts";
import { quarterOf } from "./header.ts";
import type { HeaderPeriod } from "./header.ts";
import type { CivilDate } from "../parse/calendar.ts";

export interface DateRange {
	start: CivilDate;
	end: CivilDate;
}

const DATE_PREFIX = /^(\d{4})-(\d{2})-(\d{2})(?:$|[T ])/;

export function dayRange(date: CivilDate): DateRange {
	return { start: date, end: date };
}

export function headerRange(period: HeaderPeriod, month: CivilMonth): DateRange {
	const { year } = month;
	switch (period) {
		case "month":
			return { start: { year, month: month.month, day: 1 }, end: { year, month: month.month, day: daysInMonth(year, month.month) } };
		case "quarter": {
			const last = quarterOf(month) * 3;
			return { start: { year, month: last - 2, day: 1 }, end: { year, month: last, day: daysInMonth(year, last) } };
		}
		case "year":
			return { start: { year, month: 1, day: 1 }, end: { year, month: 12, day: 31 } };
	}
}

export function daysIn(range: DateRange): CivilDate[] {
	const length = daysBetween(range.start, range.end) + 1;
	return Array.from({ length: Math.max(0, length) }, (_, index) => addDays(range.start, index));
}

export function isoDateOf(value: unknown): string | undefined {
	if (typeof value !== "string") return undefined;
	const match = DATE_PREFIX.exec(value.trim());
	if (!match) return undefined;
	const [, year, month, day] = match;
	return isValidDate(Number(year), Number(month), Number(day)) ? `${year}-${month}-${day}` : undefined;
}

export function propertyDates(frontmatter: Readonly<Record<string, unknown>> | undefined, property: string): string[] {
	if (!frontmatter) return [];
	const wanted = property.trim().toLowerCase();
	if (wanted === "") return [];
	const key = Object.keys(frontmatter).find((candidate) => candidate.toLowerCase() === wanted);
	if (key === undefined) return [];
	const value = frontmatter[key];
	const values: unknown[] = Array.isArray(value) ? value : [value];
	return [...new Set(values.flatMap((item) => isoDateOf(item) ?? []))];
}

export interface DatePropertyNotes {
	notesIn(property: string, range: DateRange): string[];
	noteChanged(path: string, oldPath?: string): void;
	reset(): void;
}

interface PropertyIndex {
	datesByPath: Map<string, string[]>;
	pathsByDate: Map<string, Set<string>>;
}

export function datePropertyNotes(paths: () => readonly string[], frontmatterOf: (path: string) => Readonly<Record<string, unknown>> | undefined): DatePropertyNotes {
	let indexes = new Map<string, PropertyIndex>();
	const place = (index: PropertyIndex, property: string, path: string) => {
		const dates = propertyDates(frontmatterOf(path), property);
		if (dates.length === 0) return;
		index.datesByPath.set(path, dates);
		for (const date of dates) {
			const notes = index.pathsByDate.get(date) ?? new Set<string>();
			notes.add(path);
			index.pathsByDate.set(date, notes);
		}
	};
	const remove = (index: PropertyIndex, path: string) => {
		for (const date of index.datesByPath.get(path) ?? []) index.pathsByDate.get(date)?.delete(path);
		index.datesByPath.delete(path);
	};
	const indexOf = (property: string): PropertyIndex => {
		const key = property.trim().toLowerCase();
		const known = indexes.get(key);
		if (known) return known;
		const index: PropertyIndex = { datesByPath: new Map(), pathsByDate: new Map() };
		for (const path of paths()) place(index, key, path);
		indexes.set(key, index);
		return index;
	};
	return {
		notesIn: (property, range) => {
			if (property.trim() === "") return [];
			const index = indexOf(property);
			return [...new Set(daysIn(range).flatMap((day) => [...(index.pathsByDate.get(isoDate(day)) ?? [])]))];
		},
		noteChanged: (path, oldPath) => {
			for (const [property, index] of indexes) {
				remove(index, path);
				if (oldPath !== undefined) remove(index, oldPath);
				place(index, property, path);
			}
		},
		reset: () => {
			indexes = new Map();
		},
	};
}
