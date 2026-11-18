import { test } from "node:test";
import { strict as assert } from "node:assert";
import { defaultSettings, mergeSettings } from "../src/settings.ts";
import {
	INSERTION_ALIAS_BY_DEFAULT_KEY,
	INSERTION_ALIAS_FORMAT_KEY,
	INSERTION_ALIAS_SHAPE_KEY,
	INSERTION_LINK_TEMPLATE_KEY,
	INSERTION_SEPARATOR_KEY,
	MENTIONS_ENABLED_KEY,
	MENTIONS_TRIGGER_KEY,
	TEMPLATE_RUNNER_KEY,
	mentionPeriodKey,
	periodKey,
	readControl,
	writeControl,
} from "../src/settings/controlKeys.ts";
import { mergeMentions } from "../src/mentions/settings.ts";
import { mergeInsertion } from "../src/insertion/settings.ts";
import { aliasFormatSample, insertionGroups } from "../src/settings/insertionPage.ts";
import { moment } from "./moment.ts";
import { presetActions } from "../src/actions/settings.ts";
import { sameTriggerWarning } from "../src/settings/mentionsPage.ts";
import { defaultDateNotes, mergeDateNotes } from "../src/dateNotes/periods.ts";

test("a fresh install gets the defaults, with English as the only parser language", () => {
	assert.deepEqual(mergeSettings(undefined), {
		languages: ["en"],
		weekStart: "locale",
		nextWeekday: "nextWeek",
		dayMonthOrder: "dayMonth",
		dateNotes: {
			imported: false,
			templateRunner: "automatic",
			periods: {
				day: { enabled: true, folder: "", format: "YYYY-MM-DD", template: "" },
				week: { enabled: true, folder: "", format: "GGGG-[W]WW", template: "" },
				month: { enabled: true, folder: "", format: "YYYY-MM", template: "" },
				quarter: { enabled: false, folder: "", format: "YYYY-[Q]Q", template: "" },
				year: { enabled: true, folder: "", format: "YYYY", template: "" },
			},
		},
		mentions: {
			enabled: true,
			trigger: "@",
			periods: { day: true, week: true, month: true, quarter: true, year: true },
		},
		insertion: { linkTemplate: "{{link}}", separator: "commaSpace", aliasShape: "format", aliasFormat: "ddd D MMM", aliasByDefault: false },
		actions: presetActions(),
	});
});

test("a Spanish interface turns on Spanish and English by default", () => {
	assert.deepEqual(defaultSettings("es").languages, ["es", "en"]);
	assert.deepEqual(defaultSettings("fr").languages, ["en"]);
});

test("stored partial settings merge over the defaults", () => {
	assert.deepEqual(mergeSettings({ weekStart: "sunday", dayMonthOrder: "monthDay" }), {
		languages: ["en"],
		weekStart: "sunday",
		nextWeekday: "nextWeek",
		dayMonthOrder: "monthDay",
		dateNotes: defaultDateNotes(),
		mentions: mergeMentions(undefined),
		insertion: mergeInsertion(undefined),
		actions: presetActions(),
	});
});

test("stored date-note settings merge over the defaults, period by period and field by field", () => {
	const merged = mergeDateNotes({
		imported: true,
		templateRunner: "templater",
		periods: {
			day: { folder: "/on/", format: "DD-MM-YYYY", template: "templates/day.md" },
			quarter: { enabled: true },
			week: { enabled: "yes", format: "  ", folder: 3 },
			decade: { enabled: true },
		},
	});
	assert.deepEqual(merged, {
		imported: true,
		templateRunner: "templater",
		periods: {
			day: { enabled: true, folder: "on", format: "DD-MM-YYYY", template: "templates/day.md" },
			week: { enabled: true, folder: "", format: "GGGG-[W]WW", template: "" },
			month: { enabled: true, folder: "", format: "YYYY-MM", template: "" },
			quarter: { enabled: true, folder: "", format: "YYYY-[Q]Q", template: "" },
			year: { enabled: true, folder: "", format: "YYYY", template: "" },
		},
	});
	assert.deepEqual(mergeDateNotes({ templateRunner: "nunjucks", periods: [] }), defaultDateNotes());
	assert.equal(mergeSettings({ dateNotes: { imported: true } }).dateNotes.imported, true);
});

test("date-note controls read and write each period's fields and the template runner", () => {
	const settings = defaultSettings();
	assert.equal(writeControl(settings, periodKey("quarter", "enabled"), true), true);
	assert.equal(writeControl(settings, periodKey("day", "folder"), "/journal/daily/"), true);
	assert.equal(writeControl(settings, periodKey("day", "format"), " YYYY/MM/YYYY-MM-DD "), true);
	assert.equal(writeControl(settings, periodKey("day", "template"), "templates/day.md"), true);
	assert.equal(writeControl(settings, periodKey("day", "format"), " "), false);
	assert.equal(writeControl(settings, periodKey("day", "enabled"), "yes"), false);
	assert.equal(writeControl(settings, TEMPLATE_RUNNER_KEY, "coreTemplates"), true);
	assert.equal(writeControl(settings, TEMPLATE_RUNNER_KEY, "nunjucks"), false);
	assert.equal(writeControl(settings, "dateNotes/decade/folder", "x"), false);
	assert.deepEqual(settings.dateNotes.periods.day, { enabled: true, folder: "journal/daily", format: "YYYY/MM/YYYY-MM-DD", template: "templates/day.md" });
	assert.equal(readControl(settings, periodKey("quarter", "enabled")), true);
	assert.equal(readControl(settings, periodKey("day", "folder")), "journal/daily");
	assert.equal(readControl(settings, TEMPLATE_RUNNER_KEY), "coreTemplates");
});

test("stored values the plugin does not know fall back to the defaults", () => {
	const merged = mergeSettings({ languages: ["es", "fr"], weekStart: "friday", nextWeekday: 3, dayMonthOrder: null });
	assert.deepEqual(merged, { languages: ["es"], weekStart: "locale", nextWeekday: "nextWeek", dayMonthOrder: "dayMonth", dateNotes: defaultDateNotes(), mentions: mergeMentions(undefined), insertion: mergeInsertion(undefined), actions: presetActions() });
	assert.deepEqual(mergeSettings([1, 2]), defaultSettings());
	assert.deepEqual(mergeSettings("broken"), defaultSettings());
});

test("settings controls read and write the settings they name", () => {
	const settings = defaultSettings();
	assert.equal(writeControl(settings, "weekStart", "monday"), true);
	assert.equal(readControl(settings, "weekStart"), "monday");
	assert.equal(writeControl(settings, "weekStart", "friday"), false);
	assert.equal(writeControl(settings, "unknown", "x"), false);
	assert.equal(readControl(settings, "weekStart"), "monday");
});

test("every Mentions control reads and writes its setting and refuses bad values", () => {
	const settings = defaultSettings();
	assert.equal(writeControl(settings, MENTIONS_ENABLED_KEY, false), true);
	assert.equal(readControl(settings, MENTIONS_ENABLED_KEY), false);
	assert.equal(writeControl(settings, MENTIONS_TRIGGER_KEY, " ; ; "), true);
	assert.equal(readControl(settings, MENTIONS_TRIGGER_KEY), ";;");
	assert.equal(writeControl(settings, MENTIONS_TRIGGER_KEY, "  "), false);
	assert.equal(settings.mentions.trigger, ";;");
	assert.equal(writeControl(settings, mentionPeriodKey("week"), false), true);
	assert.equal(readControl(settings, mentionPeriodKey("week")), false);
	assert.equal(writeControl(settings, mentionPeriodKey("week"), "no"), false);
});

test("every Insertion control reads and writes its setting and refuses bad values", () => {
	const settings = defaultSettings();
	const keys = insertionGroups(() => settings.insertion, sampleHost()).flatMap((group) => (group.items ?? []).flatMap((item) => ("control" in item && item.control ? [item.control.key] : [])));
	assert.deepEqual(keys, [INSERTION_LINK_TEMPLATE_KEY, INSERTION_SEPARATOR_KEY, INSERTION_ALIAS_BY_DEFAULT_KEY, INSERTION_ALIAS_SHAPE_KEY]);
	assert.equal(writeControl(settings, INSERTION_LINK_TEMPLATE_KEY, "- [ ] {{name}}"), true);
	assert.equal(writeControl(settings, INSERTION_LINK_TEMPLATE_KEY, "  "), false);
	assert.equal(writeControl(settings, INSERTION_LINK_TEMPLATE_KEY, 3), false);
	assert.equal(writeControl(settings, INSERTION_SEPARATOR_KEY, "bulletLines"), true);
	assert.equal(writeControl(settings, INSERTION_SEPARATOR_KEY, "tab"), false);
	assert.equal(writeControl(settings, INSERTION_ALIAS_BY_DEFAULT_KEY, true), true);
	assert.equal(writeControl(settings, INSERTION_ALIAS_BY_DEFAULT_KEY, "yes"), false);
	assert.equal(writeControl(settings, INSERTION_ALIAS_SHAPE_KEY, "typed"), true);
	assert.equal(writeControl(settings, INSERTION_ALIAS_SHAPE_KEY, "none"), false);
	assert.equal(writeControl(settings, INSERTION_ALIAS_FORMAT_KEY, " D MMM "), true);
	assert.equal(writeControl(settings, INSERTION_ALIAS_FORMAT_KEY, " "), false);
	assert.deepEqual(settings.insertion, { linkTemplate: "- [ ] {{name}}", separator: "bulletLines", aliasShape: "typed", aliasFormat: "D MMM", aliasByDefault: true });
	assert.equal(readControl(settings, INSERTION_LINK_TEMPLATE_KEY), "- [ ] {{name}}");
	assert.deepEqual(mergeSettings(JSON.parse(JSON.stringify(settings))).insertion, settings.insertion);
});

const TODAY = "2026-11-17";

function sampleHost(written: Array<[string, unknown]> = []) {
	return { today: () => moment(TODAY), write: (key: string, value: unknown) => void written.push([key, value]) };
}

interface TypedRow {
	samples: string[];
	shown: () => string;
	type: (value: string) => void;
	pick: (value: string) => void;
	field: { placeholder: string; value: string; options: Record<string, string> };
}

function renderedRow(render: (setting: never) => unknown): TypedRow {
	const samples: string[] = [];
	const field = { placeholder: "", value: "", options: {} as Record<string, string> };
	let changed: (value: string) => void = () => undefined;
	const component = {
		setPlaceholder: (placeholder: string) => ((field.placeholder = placeholder), component),
		setValue: (value: string) => ((field.value = value), component),
		addOptions: (options: Record<string, string>) => ((field.options = options), component),
		onChange: (listener: (value: string) => void) => ((changed = listener), component),
	};
	const setting = {
		infoEl: {
			createDiv: ({ text }: { text: string }) => {
				samples.push(text);
				return { setText: (next: string) => void samples.push(next) };
			},
		},
		addText: (build: (text: typeof component) => unknown) => void build(component),
		addDropdown: (build: (dropdown: typeof component) => unknown) => void build(component),
	};
	render(setting as never);
	return { samples, shown: () => samples[samples.length - 1], type: (value) => changed(value), pick: (value) => changed(value), field };
}

function renderOf(items: readonly unknown[], name: string): (setting: never) => unknown {
	const item = items.find((candidate) => (candidate as { name?: string }).name === name) as { render?: (setting: never) => unknown } | undefined;
	assert.ok(item?.render, name);
	return item.render;
}

test("the link text format shows today in the typed format and follows every keystroke", () => {
	const settings = defaultSettings();
	const written: Array<[string, unknown]> = [];
	const [, linkText] = insertionGroups(() => settings.insertion, sampleHost(written));
	const row = renderedRow(renderOf(linkText.items ?? [], "Date format of the link text"));
	assert.equal(row.field.value, "ddd D MMM");
	assert.equal(row.shown(), "Today: Tue 17 Nov");
	row.type("D/M/YY");
	assert.equal(row.shown(), "Today: 17/11/26");
	row.type("dddd");
	assert.equal(row.shown(), "Today: Tuesday");
	row.type("  ");
	assert.equal(row.shown(), "Enter a name format.");
	assert.deepEqual(written, [[INSERTION_ALIAS_FORMAT_KEY, "D/M/YY"], [INSERTION_ALIAS_FORMAT_KEY, "dddd"], [INSERTION_ALIAS_FORMAT_KEY, "  "]]);
	assert.equal(aliasFormatSample(" YYYY ", moment(TODAY)), "Today: 2026");
});

test("the Mentions page warns only when another plugin shares the trigger", () => {
	assert.equal(sameTriggerWarning([]), undefined);
	assert.match(sameTriggerWarning(["Natural Language Dates", "Date List"]) ?? "", /Natural Language Dates, Date List also suggests/);
});

test("the stored language order survives a load, and repeated or unknown languages are dropped", () => {
	assert.deepEqual(mergeSettings({ languages: ["es", "en"] }).languages, ["es", "en"]);
	assert.deepEqual(mergeSettings({ languages: ["en", "es", "en", "fr"] }).languages, ["en", "es"]);
});
