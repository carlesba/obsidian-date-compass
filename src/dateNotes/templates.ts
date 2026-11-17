import type { Moment } from "moment";
import { isRecord } from "./periods.ts";
import type { TemplateRunnerChoice } from "./periods.ts";

export type TemplateRunner = "templater" | "coreTemplates" | "builtIn";

export interface InstalledRunners {
	templater: boolean;
	coreTemplates: boolean;
}

export interface ChosenRunner {
	runner: TemplateRunner;
	templaterMissing: boolean;
}

export interface CoreTemplateFormats {
	dateFormat: string;
	timeFormat: string;
}

export const DEFAULT_TEMPLATE_FORMATS: CoreTemplateFormats = { dateFormat: "YYYY-MM-DD", timeFormat: "HH:mm" };

export interface TemplateValues {
	title: string;
	date: Moment;
	now: Moment;
	formats: CoreTemplateFormats;
}

export function chooseRunner(choice: TemplateRunnerChoice, installed: InstalledRunners): ChosenRunner {
	if (choice === "coreTemplates") return { runner: "coreTemplates", templaterMissing: false };
	if (installed.templater) return { runner: "templater", templaterMissing: false };
	const fallback: TemplateRunner = installed.coreTemplates ? "coreTemplates" : "builtIn";
	return { runner: fallback, templaterMissing: choice === "templater" };
}

export function coreTemplateFormats(options: unknown): CoreTemplateFormats {
	const record = isRecord(options) ? options : {};
	return {
		dateFormat: nonEmpty(record.dateFormat) ?? DEFAULT_TEMPLATE_FORMATS.dateFormat,
		timeFormat: nonEmpty(record.timeFormat) ?? DEFAULT_TEMPLATE_FORMATS.timeFormat,
	};
}

export function renderTemplate(template: string, values: TemplateValues): string {
	return template.replace(/{{\s*(title|date|time)\s*(?::([^}]*))?}}/g, (_match: string, name: string, format: string | undefined) => {
		if (name === "title") return values.title;
		const custom = format?.trim();
		if (name === "date") return values.date.format(custom || values.formats.dateFormat);
		return values.now.format(custom || values.formats.timeFormat);
	});
}

function nonEmpty(value: unknown): string | undefined {
	return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}
