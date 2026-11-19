import type { PeriodSettingsByPeriod } from "../dateNotes/periods.ts";
import type { CivilMonth } from "./grid.ts";

export type HeaderPeriod = "month" | "quarter" | "year";

export interface HeaderPart {
	period: HeaderPeriod;
	label: string;
	clickable: boolean;
}

export function quarterOf(month: CivilMonth): number {
	return Math.ceil(month.month / 3);
}

export function headerParts(month: CivilMonth, monthName: string, periods: PeriodSettingsByPeriod): HeaderPart[] {
	const monthPart: HeaderPart = { period: "month", label: monthName, clickable: periods.month.enabled };
	const quarterPart: HeaderPart = { period: "quarter", label: `Q${quarterOf(month)}`, clickable: periods.quarter.enabled };
	const yearPart: HeaderPart = { period: "year", label: String(month.year), clickable: periods.year.enabled };
	return periods.quarter.enabled ? [monthPart, yearPart, quarterPart] : [monthPart, yearPart];
}
