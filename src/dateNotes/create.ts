import { t } from "../i18n/index.ts";
import { dateOf, notePath } from "./paths.ts";
import type { MomentFactory } from "./paths.ts";
import type { DateNotesSettings, Period } from "./periods.ts";
import { DEFAULT_TEMPLATE_FORMATS, chooseRunner, coreTemplateFormats, renderTemplate } from "./templates.ts";
import type { Moment } from "moment";

export interface TemplaterApi {
	createFromTemplate(templatePath: string, notePath: string): Promise<void>;
}

export interface DateNoteHost {
	moment: MomentFactory;
	exists(path: string): boolean;
	read(path: string): Promise<string>;
	createNote(path: string, content: string): Promise<void>;
	templater(): TemplaterApi | undefined;
	coreTemplatesOptions(): unknown;
	notify(message: string): void;
}

export async function ensureDateNote(
	host: DateNoteHost,
	settings: DateNotesSettings,
	date: Moment,
	period: Period,
): Promise<string | undefined> {
	const path = notePath(date, period, settings.periods);
	if (host.exists(path)) return path;
	const template = settings.periods[period].template;
	if (template === "") {
		await host.createNote(path, "");
		return path;
	}
	if (!host.exists(template)) {
		host.notify(t("templateNotFound", { path: template }));
		await host.createNote(path, "");
		return path;
	}
	const templater = host.templater();
	const coreOptions = host.coreTemplatesOptions();
	const { runner, templaterMissing } = chooseRunner(settings.templateRunner, {
		templater: templater !== undefined,
		coreTemplates: coreOptions !== undefined,
	});
	if (templaterMissing) host.notify(t("templaterNotEnabled"));
	if (runner === "templater" && templater) {
		await templater.createFromTemplate(template, path);
		if (host.exists(path)) return path;
		host.notify(t("templaterFailed", { path }));
		return undefined;
	}
	const content = renderTemplate(await host.read(template), {
		title: path.split("/").pop()?.replace(/\.md$/, "") ?? "",
		date: dateOf(path, settings.periods, host.moment)?.date ?? date,
		now: host.moment(),
		formats: runner === "coreTemplates" ? coreTemplateFormats(coreOptions) : DEFAULT_TEMPLATE_FORMATS,
	});
	await host.createNote(path, content);
	return path;
}
