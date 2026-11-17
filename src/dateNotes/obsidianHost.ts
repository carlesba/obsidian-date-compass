import { Notice, TFile, moment } from "obsidian";
import type { App, TFolder } from "obsidian";
import type { DateNoteHost, TemplaterApi } from "./create.ts";
import type { ExternalDateNotes } from "./import.ts";
import type { MomentFactory } from "./paths.ts";

const TEMPLATER_ID = "templater-obsidian";
const PERIODIC_NOTES_ID = "periodic-notes";

interface TemplaterInstance {
	create_new_note_from_template?: (template: TFile, folder: TFolder | string, filename: string, openNewNote: boolean) => Promise<unknown>;
}

interface CommunityPlugin {
	settings?: unknown;
	templater?: TemplaterInstance;
}

interface InternalPlugin {
	enabled?: boolean;
	instance?: { options?: unknown };
}

interface PluginRegistries {
	plugins?: {
		enabledPlugins?: Set<string>;
		manifests?: Record<string, unknown>;
		getPlugin?(id: string): CommunityPlugin | null | undefined;
	};
	internalPlugins?: { getPluginById?(id: string): InternalPlugin | null | undefined };
}

export const obsidianMoment: MomentFactory = moment;

export function createDateNoteHost(app: App): DateNoteHost {
	return {
		moment: obsidianMoment,
		exists: (path) => app.vault.getFileByPath(path) !== null,
		read: async (path) => {
			const file = app.vault.getFileByPath(path);
			return file ? app.vault.read(file) : "";
		},
		createNote: async (path, content) => {
			await ensureFolder(app, parentOf(path));
			await app.vault.create(path, content);
		},
		templater: () => templaterApi(app),
		coreTemplatesOptions: () => readSafely(() => enabledInternalOptions(app, "templates")),
		notify: (message) => new Notice(message),
	};
}

export function enabledExternalDateNotes(app: App): ExternalDateNotes {
	return {
		periodicNotes: readSafely(() => registries(app).plugins?.getPlugin?.(PERIODIC_NOTES_ID)?.settings),
		dailyNotes: readSafely(() => enabledInternalOptions(app, "daily-notes")),
	};
}

export async function installedExternalDateNotes(app: App): Promise<ExternalDateNotes> {
	const enabled = enabledExternalDateNotes(app);
	if (enabled.periodicNotes !== undefined) return enabled;
	const installed = readSafely(() => registries(app).plugins?.manifests?.[PERIODIC_NOTES_ID]) !== undefined;
	if (!installed) return enabled;
	return { ...enabled, periodicNotes: await readPluginData(app, PERIODIC_NOTES_ID) };
}

function templaterApi(app: App): TemplaterApi | undefined {
	const plugins = registries(app).plugins;
	if (!readSafely(() => plugins?.enabledPlugins?.has(TEMPLATER_ID))) return undefined;
	const templater = readSafely(() => plugins?.getPlugin?.(TEMPLATER_ID)?.templater);
	const create = templater?.create_new_note_from_template;
	if (typeof create !== "function") return undefined;
	return {
		createFromTemplate: async (templatePath, notePath) => {
			const template = app.vault.getFileByPath(templatePath);
			if (!(template instanceof TFile)) return;
			const name = notePath.split("/").pop()?.replace(/\.md$/, "") ?? notePath;
			const folder = parentOf(notePath);
			await create.call(templater, template, folder === "" ? app.vault.getRoot() : folder, name, false);
		},
	};
}

function enabledInternalOptions(app: App, id: string): unknown {
	const plugin = registries(app).internalPlugins?.getPluginById?.(id);
	return plugin?.enabled ? plugin.instance?.options : undefined;
}

async function readPluginData(app: App, id: string): Promise<unknown> {
	try {
		return JSON.parse(await app.vault.adapter.read(`${app.vault.configDir}/plugins/${id}/data.json`)) as unknown;
	} catch {
		return undefined;
	}
}

function registries(app: App): PluginRegistries {
	return app as App & PluginRegistries;
}

function parentOf(path: string): string {
	return path.split("/").slice(0, -1).join("/");
}

async function ensureFolder(app: App, folder: string): Promise<void> {
	if (folder !== "" && !app.vault.getFolderByPath(folder)) await app.vault.createFolder(folder);
}

function readSafely<T>(read: () => T): T | undefined {
	try {
		return read();
	} catch {
		return undefined;
	}
}
