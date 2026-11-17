import type { Unit, Weekday } from "./types.ts";

export interface CivilDate {
	year: number;
	month: number;
	day: number;
}

const DAY_MS = 86_400_000;

export function civilOf(now: Date): CivilDate {
	return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}

export function isValidDate(year: number, month: number, day: number): boolean {
	if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
	if (month < 1 || month > 12 || day < 1) return false;
	return day <= daysInMonth(year, month);
}

export function daysInMonth(year: number, month: number): number {
	return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function toEpochDay(date: CivilDate): number {
	return Math.round(Date.UTC(date.year, date.month - 1, date.day) / DAY_MS);
}

function fromEpochDay(epochDay: number): CivilDate {
	const value = new Date(epochDay * DAY_MS);
	return { year: value.getUTCFullYear(), month: value.getUTCMonth() + 1, day: value.getUTCDate() };
}

export function addDays(date: CivilDate, days: number): CivilDate {
	return fromEpochDay(toEpochDay(date) + days);
}

export function addMonths(date: CivilDate, months: number): CivilDate {
	const monthIndex = date.year * 12 + (date.month - 1) + months;
	const year = Math.floor(monthIndex / 12);
	const month = monthIndex - year * 12 + 1;
	return { year, month, day: Math.min(date.day, daysInMonth(year, month)) };
}

export function addUnits(date: CivilDate, amount: number, unit: Unit): CivilDate {
	switch (unit) {
		case "day":
			return addDays(date, amount);
		case "week":
			return addDays(date, amount * 7);
		case "month":
			return addMonths(date, amount);
		case "quarter":
			return addMonths(date, amount * 3);
		case "year":
			return addMonths(date, amount * 12);
	}
}

export function weekdayOf(date: CivilDate): Weekday {
	return new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay() as Weekday;
}

export function daysBetween(from: CivilDate, to: CivilDate): number {
	return toEpochDay(to) - toEpochDay(from);
}

export function isoDate(date: CivilDate): string {
	return `${String(date.year).padStart(4, "0")}-${pad(date.month)}-${pad(date.day)}`;
}

function pad(value: number): string {
	return String(value).padStart(2, "0");
}
