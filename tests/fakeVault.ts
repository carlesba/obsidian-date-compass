import type { DateNoteHost, TemplaterApi } from "../src/dateNotes/create.ts";
import { moment } from "./moment.ts";

export interface FakeTemplaterOptions {
	folderTemplates?: { folder: string; template: string }[];
	fileTemplates?: { regex: string; template: string }[];
	parseDelayMs?: number;
}

export interface FakeVaultOptions {
	templater?: FakeTemplaterOptions;
	coreTemplatesOptions?: unknown;
	now?: string;
}

export interface TemplateApplication {
	template: string;
	path: string;
	by: "command" | "folderRule" | "fileRule";
}

export interface FakeVault {
	host: DateNoteHost;
	content(path: string): string | undefined;
	paths(): string[];
	notices: string[];
	templateApplications: TemplateApplication[];
	settled(): Promise<void>;
}

const TEMPLATER_TRIGGER_DELAY_MS = 20;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function fakeVault(initial: Record<string, string>, options: FakeVaultOptions = {}): FakeVault {
	const files = new Map(Object.entries(initial));
	const notices: string[] = [];
	const templateApplications: TemplateApplication[] = [];
	const running: Promise<void>[] = [];
	const createListeners: ((path: string) => void)[] = [];
	const create = (path: string, content: string) => {
		if (files.has(path)) throw new Error(`${path} exists`);
		files.set(path, content);
		for (const listener of createListeners) listener(path);
	};
	const templater = options.templater ? fakeTemplater(options.templater) : undefined;

	function fakeTemplater(rules: FakeTemplaterOptions): TemplaterApi {
		const pending = new Set<string>();
		const parse = async (template: string, path: string, by: TemplateApplication["by"]) => {
			await wait(rules.parseDelayMs ?? 0);
			templateApplications.push({ template, path, by });
			const title = path.split("/").pop()!.replace(/\.md$/, "");
			return (files.get(template) ?? "").replace(/<% tp\.file\.title %>/g, title);
		};
		const writeTemplateToFile = async (template: string, path: string, by: TemplateApplication["by"]) => {
			pending.add(path);
			const output = await parse(template, path, by);
			files.set(path, (files.get(path) ?? "") + output);
			pending.delete(path);
		};
		const onFileCreation = async (path: string) => {
			await wait(TEMPLATER_TRIGGER_DELAY_MS);
			if (pending.has(path) || (files.get(path) ?? "").length !== 0) return;
			const parent = path.split("/").slice(0, -1).join("/");
			const folderRule = rules.folderTemplates?.find((rule) => parent === rule.folder || parent.startsWith(`${rule.folder}/`));
			if (folderRule) return writeTemplateToFile(folderRule.template, path, "folderRule");
			const fileRule = rules.fileTemplates?.find((rule) => new RegExp(rule.regex).test(path));
			if (fileRule) return writeTemplateToFile(fileRule.template, path, "fileRule");
		};
		createListeners.push((path) => running.push(onFileCreation(path)));
		return {
			createFromTemplate: async (template, path) => {
				create(path, "");
				pending.add(path);
				const output = await parse(template, path, "command");
				files.set(path, output);
				pending.delete(path);
			},
		};
	}

	const host: DateNoteHost = {
		moment: (input, format, strict) => (input === undefined && options.now ? moment(options.now) : moment(input, format, strict)),
		exists: (path) => files.has(path),
		read: async (path) => files.get(path) ?? "",
		createNote: async (path, content) => create(path, content),
		templater: () => templater,
		coreTemplatesOptions: () => options.coreTemplatesOptions,
		notify: (message) => notices.push(message),
	};
	return {
		host,
		content: (path) => files.get(path),
		paths: () => [...files.keys()],
		notices,
		templateApplications,
		settled: async () => {
			while (running.length > 0) await running.shift();
		},
	};
}
