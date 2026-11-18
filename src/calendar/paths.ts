import type { Moment } from "moment";
import { notePath } from "../dateNotes/paths.ts";
import type { Period, PeriodSettingsByPeriod } from "../dateNotes/periods.ts";
import type { CivilDate } from "../parse/calendar.ts";
import { firstDayOf } from "./grid.ts";
import type { MonthGrid } from "./grid.ts";
import type { HeaderPeriod } from "./header.ts";

export interface VisibleRow {
	week: string | undefined;
	days: (string | undefined)[];
}

export interface VisibleNotes {
	rows: VisibleRow[];
	header: Record<HeaderPeriod, string | undefined>;
	visiblePaths: Set<string>;
}

export function visibleNotes(grid: MonthGrid, periods: PeriodSettingsByPeriod, toMoment: (date: CivilDate) => Moment): VisibleNotes {
	const visiblePaths = new Set<string>();
	const pathOf = (date: CivilDate, period: Period): string | undefined => {
		if (!periods[period].enabled) return undefined;
		const path = notePath(toMoment(date), period, periods);
		visiblePaths.add(path);
		return path;
	};
	const rows = grid.rows.map((row) => ({
		week: pathOf(row.weekNoteDate, "week"),
		days: row.days.map((day) => pathOf(day.date, "day")),
	}));
	const displayed = firstDayOf(grid.month);
	const header = { month: pathOf(displayed, "month"), quarter: pathOf(displayed, "quarter"), year: pathOf(displayed, "year") };
	return { rows, header, visiblePaths };
}

export function touchesVisible(visiblePaths: ReadonlySet<string>, path: string, oldPath?: string): boolean {
	return visiblePaths.has(path) || (oldPath !== undefined && visiblePaths.has(oldPath));
}

export function activeNoteTouchesVisible(visiblePaths: ReadonlySet<string>, activePath: string | undefined, previousActivePath: string | undefined): boolean {
	if (activePath === previousActivePath) return false;
	return [activePath, previousActivePath].some((path) => path !== undefined && visiblePaths.has(path));
}
