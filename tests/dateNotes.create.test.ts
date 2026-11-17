import { test } from "node:test";
import { strict as assert } from "node:assert";
import { ensureDateNote } from "../src/dateNotes/create.ts";
import { defaultDateNotes } from "../src/dateNotes/periods.ts";
import type { DateNotesSettings } from "../src/dateNotes/periods.ts";
import { chooseRunner, renderTemplate } from "../src/dateNotes/templates.ts";
import { DEFAULT_LANGUAGE, setLanguage } from "../src/i18n/index.ts";
import { fakeVault } from "./fakeVault.ts";
import type { FakeTemplaterOptions } from "./fakeVault.ts";
import { moment } from "./moment.ts";

setLanguage(DEFAULT_LANGUAGE);

const TODAY = moment("2026-11-17 09:30", "YYYY-MM-DD HH:mm", true);

const TEMPLATES = {
	"templates/day.md": "# <% tp.file.title %>\n",
	"templates/core.md": "# {{title}} · {{date}} · {{date:dddd}} · {{time}}\n",
	"templates/other.md": "other rule\n",
};

function settingsWith(change: (settings: DateNotesSettings) => void): DateNotesSettings {
	const settings = defaultDateNotes();
	settings.periods.day.folder = "on";
	change(settings);
	return settings;
}

const FOLDER_RULE: FakeTemplaterOptions = { folderTemplates: [{ folder: "on", template: "templates/day.md" }] };
const REGEX_RULE: FakeTemplaterOptions = { fileTemplates: [{ regex: "on/\\d{4}-\\d{2}-\\d{2}.md$", template: "templates/day.md" }] };

for (const [rule, rules] of [
	["folder", FOLDER_RULE],
	["regex", REGEX_RULE],
] as const) {
	for (const parseDelayMs of [0, 60]) {
		test(`Templater applies the template once when its ${rule} rule also matches (parse ${parseDelayMs} ms)`, async () => {
			const vault = fakeVault(TEMPLATES, { templater: { ...rules, parseDelayMs } });
			const settings = settingsWith((s) => (s.periods.day.template = "templates/day.md"));
			assert.equal(await ensureDateNote(vault.host, settings, TODAY, "day"), "on/2026-11-17.md");
			await vault.settled();
			assert.deepEqual(vault.templateApplications, [{ template: "templates/day.md", path: "on/2026-11-17.md", by: "command" }]);
			assert.equal(vault.content("on/2026-11-17.md"), "# 2026-11-17\n");
		});
	}
}

test("the built-in renderer fills the note before Templater's rules look at it, so they stay out", async () => {
	const vault = fakeVault(TEMPLATES, { templater: FOLDER_RULE, coreTemplatesOptions: { dateFormat: "D MMM YYYY", timeFormat: "H:mm" }, now: "2026-11-20T08:05:00" });
	const settings = settingsWith((s) => {
		s.periods.day.template = "templates/core.md";
		s.templateRunner = "coreTemplates";
	});
	await ensureDateNote(vault.host, settings, TODAY, "day");
	await vault.settled();
	assert.deepEqual(vault.templateApplications, []);
	assert.equal(vault.content("on/2026-11-17.md"), "# 2026-11-17 · 17 Nov 2026 · Tuesday · 8:05\n");
});

test("a period without a template creates an empty note, leaving Templater's rules in charge", async () => {
	const vault = fakeVault(TEMPLATES, { templater: REGEX_RULE });
	await ensureDateNote(vault.host, settingsWith(() => {}), TODAY, "day");
	await vault.settled();
	assert.deepEqual(vault.templateApplications, [{ template: "templates/day.md", path: "on/2026-11-17.md", by: "fileRule" }]);
	assert.equal(vault.content("on/2026-11-17.md"), "# 2026-11-17\n");
});

test("an existing note is opened as it is", async () => {
	const vault = fakeVault({ ...TEMPLATES, "on/2026-11-17.md": "kept" }, { templater: FOLDER_RULE });
	const settings = settingsWith((s) => (s.periods.day.template = "templates/day.md"));
	assert.equal(await ensureDateNote(vault.host, settings, TODAY, "day"), "on/2026-11-17.md");
	await vault.settled();
	assert.deepEqual(vault.templateApplications, []);
	assert.equal(vault.content("on/2026-11-17.md"), "kept");
});

test("a missing template file creates an empty note and says so", async () => {
	const vault = fakeVault({});
	const settings = settingsWith((s) => (s.periods.day.template = "templates/gone.md"));
	await ensureDateNote(vault.host, settings, TODAY, "day");
	assert.equal(vault.content("on/2026-11-17.md"), "");
	assert.deepEqual(vault.notices, ["Template templates/gone.md was not found, so the note was created empty."]);
});

test("choosing Templater when it is not enabled falls back to the built-in renderer and says so", async () => {
	const vault = fakeVault(TEMPLATES, { now: "2026-11-17T10:00:00" });
	const settings = settingsWith((s) => {
		s.periods.week.template = "templates/core.md";
		s.templateRunner = "templater";
	});
	assert.equal(await ensureDateNote(vault.host, settings, TODAY, "week"), "2026-W47.md");
	assert.equal(vault.content("2026-W47.md"), "# 2026-W47 · 2026-11-16 · Monday · 10:00\n");
	assert.deepEqual(vault.notices, ["Templater is not enabled, so Date Compass filled in the template."]);
});

test("Automatic prefers Templater, then core Templates, then the built-in renderer", () => {
	assert.deepEqual(chooseRunner("automatic", { templater: true, coreTemplates: true }), { runner: "templater", templaterMissing: false });
	assert.deepEqual(chooseRunner("automatic", { templater: false, coreTemplates: true }), { runner: "coreTemplates", templaterMissing: false });
	assert.deepEqual(chooseRunner("automatic", { templater: false, coreTemplates: false }), { runner: "builtIn", templaterMissing: false });
	assert.deepEqual(chooseRunner("templater", { templater: true, coreTemplates: true }), { runner: "templater", templaterMissing: false });
	assert.deepEqual(chooseRunner("templater", { templater: false, coreTemplates: false }), { runner: "builtIn", templaterMissing: true });
	assert.deepEqual(chooseRunner("coreTemplates", { templater: true, coreTemplates: false }), { runner: "coreTemplates", templaterMissing: false });
});

test("the built-in renderer takes {{date}} from the note and {{time}} from now", () => {
	const rendered = renderTemplate("{{title}} {{date}} {{date:YYYY [W]WW}} {{time}} {{time:HH}} {{other}}", {
		title: "2026-11-17",
		date: TODAY,
		now: moment("2026-12-01 18:45", "YYYY-MM-DD HH:mm", true),
		formats: { dateFormat: "YYYY-MM-DD", timeFormat: "HH:mm" },
	});
	assert.equal(rendered, "2026-11-17 2026-11-17 2026 W47 18:45 18 {{other}}");
});
