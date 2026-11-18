import { test } from "node:test";
import { strict as assert } from "node:assert";
import { defaultSettings, mergeSettings } from "../src/settings.ts";
import { TEMPLATE_RUNNER_KEY, mentionKey, mentionKeyParts, mentionKeyPrefix, periodKey, readControl, writeControl } from "../src/settings/controlKeys.ts";
import { defaultMentions } from "../src/mentions/settings.ts";
import type { Mention } from "../src/mentions/settings.ts";
import type { TriggerClash } from "../src/mentions/clashes.ts";
import type { Period } from "../src/dateNotes/periods.ts";
import { aliasFormatSample, linkStyleItems } from "../src/settings/linkStylePage.ts";
import type { LinkStyleHost, TargetChoice } from "../src/settings/linkStylePage.ts";
import { mentionsPage } from "../src/settings/mentionsPage.ts";
import { moment } from "./moment.ts";
import { localizationPage } from "../src/settings/localizationPage.ts";
import type { LanguageChoice, LocalizationPageContext } from "../src/settings/localizationPage.ts";
import { pagePath } from "../src/settings/pages.ts";
import { DEFAULT_LANGUAGE, setLanguage } from "../src/i18n/index.ts";
import type { DateCompassSettings, ParserLanguage } from "../src/settings.ts";
import { presetCommands } from "../src/commands/settings.ts";
import { defaultDateNotes, mergeDateNotes } from "../src/dateNotes/periods.ts";
import { defaultDecorators } from "../src/calendar/decorators.ts";

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
				week: { enabled: false, folder: "", format: "GGGG-[W]WW", template: "" },
				month: { enabled: false, folder: "", format: "YYYY-MM", template: "" },
				quarter: { enabled: false, folder: "", format: "YYYY-[Q]Q", template: "" },
				year: { enabled: false, folder: "", format: "YYYY", template: "" },
			},
		},
		calendar: { showWeekNumbers: true, confirmBeforeCreate: true, decorators: defaultDecorators(), themeCompatibility: false },
		mentions: [
			{ id: "mention-1", trigger: "@", targets: ["day", "week", "month", "quarter", "year"], template: "{{link}}", linkPath: "shortestWhenSafe", separator: "commaSpace", aliasShape: "format", aliasFormat: "ddd D MMM" },
		],
		commands: [
			{ id: "insert-dates", name: "Insert dates", destination: "cursor", property: "", mode: "add", asks: "dates", link: true, targets: ["day", "week", "month", "quarter", "year"], template: "{{link}}", linkPath: "shortestWhenSafe", separator: "commaSpace", aliasShape: "format", aliasFormat: "ddd D MMM" },
		],
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
		calendar: { showWeekNumbers: true, confirmBeforeCreate: true, decorators: defaultDecorators(), themeCompatibility: false },
		mentions: defaultMentions(),
		commands: presetCommands(),
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
			week: { enabled: false, folder: "", format: "GGGG-[W]WW", template: "" },
			month: { enabled: false, folder: "", format: "YYYY-MM", template: "" },
			quarter: { enabled: true, folder: "", format: "YYYY-[Q]Q", template: "" },
			year: { enabled: false, folder: "", format: "YYYY", template: "" },
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
	assert.deepEqual(merged, { languages: ["es"], weekStart: "locale", nextWeekday: "nextWeek", dayMonthOrder: "dayMonth", dateNotes: defaultDateNotes(), calendar: { showWeekNumbers: true, confirmBeforeCreate: true, decorators: defaultDecorators(), themeCompatibility: false }, mentions: defaultMentions(), commands: presetCommands() });
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

test("every control of a mention reads and writes its field and refuses bad values", () => {
	const settings = defaultSettings();
	const key = (field: Parameters<typeof mentionKey>[1]) => mentionKey("mention-1", field);
	assert.equal(key("trigger"), "mentions/mention-1/trigger");
	assert.equal(readControl(settings, key("trigger")), "@");
	assert.equal(writeControl(settings, key("trigger"), " ; ; "), true);
	assert.equal(readControl(settings, key("trigger")), ";;");
	assert.equal(writeControl(settings, key("trigger"), "  "), false);
	assert.equal(writeControl(settings, key("trigger"), 3), false);
	assert.equal(writeControl(settings, key("linkPath"), "fullPath"), true);
	assert.equal(writeControl(settings, key("linkPath"), "relative"), false);
	assert.equal(writeControl(settings, key("template"), "- [ ] {{name}}"), true);
	assert.equal(writeControl(settings, key("template"), "  "), false);
	assert.equal(writeControl(settings, key("template"), 3), false);
	assert.equal(writeControl(settings, key("separator"), "bulletLines"), true);
	assert.equal(writeControl(settings, key("separator"), "tab"), false);
	assert.equal(writeControl(settings, key("aliasShape"), "typed"), true);
	assert.equal(writeControl(settings, key("aliasShape"), "none"), false);
	assert.equal(writeControl(settings, key("aliasFormat"), " D MMM "), true);
	assert.equal(writeControl(settings, key("aliasFormat"), " "), false);
	assert.equal(writeControl(settings, key("targets"), ["month", "day"]), true);
	assert.deepEqual(readControl(settings, key("targets")), ["month", "day"]);
	assert.equal(writeControl(settings, key("targets"), []), false);
	assert.equal(writeControl(settings, key("targets"), ["day", "day"]), false);
	assert.equal(writeControl(settings, key("targets"), ["day", "decade"]), false);
	assert.equal(writeControl(settings, key("targets"), "day"), false);
	assert.deepEqual(settings.mentions, [{ id: "mention-1", trigger: ";;", targets: ["month", "day"], template: "- [ ] {{name}}", linkPath: "fullPath", separator: "bulletLines", aliasShape: "typed", aliasFormat: "D MMM" }]);
	assert.deepEqual(mergeSettings(JSON.parse(JSON.stringify(settings))).mentions, settings.mentions);
});

test("a mention control names an existing mention and one of its fields, nothing else", () => {
	const settings = defaultSettings();
	assert.deepEqual(mentionKeyParts("mentions/mention-1/trigger"), { mentionId: "mention-1", field: "trigger" });
	assert.equal(mentionKeyParts("mentions/mention-1/id"), undefined);
	assert.equal(mentionKeyParts("mentions/mention-1/trigger/extra"), undefined);
	assert.equal(mentionKeyParts("commands/set-dates/name"), undefined);
	assert.equal(writeControl(settings, mentionKey("missing", "trigger"), "!"), false);
	assert.equal(readControl(settings, mentionKey("missing", "trigger")), undefined);
	assert.equal(writeControl(settings, "mentions/enabled", false), false);
	assert.equal(writeControl(settings, "insertion/linkPath", "fullPath"), false);
	assert.deepEqual(settings, defaultSettings());
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

interface StyleHostLog {
	written: Array<[string, unknown]>;
	notices: string[];
	offered: string[][];
}

function styleHost(mention: () => Mention | undefined, log: StyleHostLog, offPeriods: Period[] = ["quarter"]): LinkStyleHost {
	return {
		today: () => moment(TODAY),
		write: (key: string, value: unknown) => {
			log.written.push([key, value]);
			const target = mention();
			if (target && key.endsWith("/targets")) target.targets = value as Period[];
		},
		isEnabledInDateNotes: (period: Period) => !offPeriods.includes(period),
		chooseTarget: (_anchor: HTMLElement, choices: TargetChoice[], pick: (period: Period) => void) => {
			log.offered.push(choices.map((choice) => choice.name));
			pick(choices[0].period);
		},
		notify: (message: string) => void log.notices.push(message),
	};
}

function newLog(): StyleHostLog {
	return { written: [], notices: [], offered: [] };
}

interface ItemLike {
	type?: string;
	id?: string;
	name?: string;
	desc?: string;
	heading?: string;
	visible?: boolean | (() => boolean);
	status?: () => "warning" | null;
	control?: { type: string; key: string };
	items?: ItemLike[];
	onDelete?: (position: number) => void;
	onReorder?: (from: number, to: number) => void;
	addItem?: { name: string; action: (anchor: HTMLElement) => void };
	emptyState?: string;
}

function styleItems(mention: Mention, log: StyleHostLog, fields?: Parameters<typeof linkStyleItems>[0]["fields"]): ItemLike[] {
	return linkStyleItems({ keyPrefix: mentionKeyPrefix(mention.id), style: () => mention, host: styleHost(() => mention, log), fields }) as unknown as ItemLike[];
}

function controlKeysOf(items: readonly ItemLike[]): string[] {
	return items.flatMap((item) => [...(item.control ? [item.control.key] : []), ...controlKeysOf(item.items ?? [])]);
}

test("the link style fields are the targets, then the links and then the link text, keyed under the given prefix", () => {
	const [mention] = defaultMentions();
	const items = styleItems(mention, newLog());
	assert.deepEqual(items.map((item) => [item.type, item.heading]), [["list", "Target periods"], ["group", "Links"], ["group", "Link text"]]);
	assert.deepEqual(items[1].items?.map((item) => item.name), ["Text around each link", "Path in each link", "Between several links"]);
	assert.deepEqual(items[2].items?.map((item) => item.name), ["What the link text says", "Date format of the link text"]);
	assert.deepEqual(controlKeysOf(items), ["template", "linkPath", "separator", "aliasShape"].map((field) => `mentions/mention-1/${field}`));
});

test("the link style fields can be limited to some of them, leaving out empty groups", () => {
	const [mention] = defaultMentions();
	const items = styleItems(mention, newLog(), ["linkPath", "aliasShape", "aliasFormat"]);
	assert.deepEqual(items.map((item) => item.heading), ["Links", "Link text"]);
	assert.deepEqual(controlKeysOf(items), ["mentions/mention-1/linkPath", "mentions/mention-1/aliasShape"]);
	assert.deepEqual(styleItems(mention, newLog(), ["targets", "linkPath"]).map((item) => item.heading), ["Target periods", "Links"]);
});

test("the date format of the link text shows only for the date format shape", () => {
	const [mention] = defaultMentions();
	const format = () => styleItems(mention, newLog())[2].items?.[1].visible as () => boolean;
	assert.equal(format()(), true);
	mention.aliasShape = "typed";
	assert.equal(format()(), false);
});

test("the targets list has one row per target and says which ones are off in Date notes", () => {
	const [mention] = defaultMentions();
	const [targets] = styleItems(mention, newLog());
	assert.deepEqual(targets.items?.map((row) => row.name), ["Daily notes", "Weekly notes", "Monthly notes", "Quarterly notes", "Yearly notes"]);
	assert.deepEqual(targets.items?.map((row) => row.desc !== undefined), [false, false, false, true, false]);
	assert.match(targets.items?.[3].desc ?? "", /Turned off in Date notes/);
	assert.equal(targets.items?.some((row) => row.control !== undefined), false);
	assert.equal(targets.onReorder, undefined);
});

test("the targets list always offers add and remove, asking which period to add and refusing to drop the last one", () => {
	const [mention] = defaultMentions();
	const log = newLog();
	const targets = () => styleItems(mention, log)[0];
	targets().addItem?.action({} as HTMLElement);
	assert.deepEqual(log.notices, ["Every period is already listed."]);
	targets().onDelete?.(1);
	targets().onDelete?.(1);
	targets().onDelete?.(1);
	targets().onDelete?.(1);
	assert.deepEqual(mention.targets, ["day"]);
	targets().onDelete?.(0);
	assert.deepEqual(mention.targets, ["day"]);
	assert.deepEqual(log.notices, ["Every period is already listed.", "Keep at least one period."]);
	targets().addItem?.action({} as HTMLElement);
	assert.deepEqual(log.offered, [["Weekly notes", "Monthly notes", "Quarterly notes", "Yearly notes"]]);
	assert.deepEqual(mention.targets, ["day", "week"]);
	mention.targets = ["day", "week", "month", "quarter"];
	targets().addItem?.action({} as HTMLElement);
	assert.deepEqual(log.offered[1], ["Yearly notes"]);
	assert.deepEqual(mention.targets, ["day", "week", "month", "quarter", "year"]);
	assert.deepEqual(log.written.map(([key]) => key), Array(6).fill("mentions/mention-1/targets"));
});

test("the link text format shows today in the typed format and follows every keystroke", () => {
	const [mention] = defaultMentions();
	const log = newLog();
	const [, , linkText] = styleItems(mention, log);
	const row = renderedRow(renderOf(linkText.items ?? [], "Date format of the link text"));
	assert.equal(row.field.value, "ddd D MMM");
	assert.equal(row.shown(), "Today: Tue 17 Nov");
	row.type("D/M/YY");
	assert.equal(row.shown(), "Today: 17/11/26");
	row.type("dddd");
	assert.equal(row.shown(), "Today: Tuesday");
	row.type("  ");
	assert.equal(row.shown(), "Enter a name format.");
	const key = "mentions/mention-1/aliasFormat";
	assert.deepEqual(log.written, [[key, "D/M/YY"], [key, "dddd"], [key, "  "]]);
	assert.equal(aliasFormatSample(" YYYY ", moment(TODAY)), "Today: 2026");
});

function mentions(settings: DateCompassSettings, clashes: Record<string, TriggerClash[]> = {}) {
	const opened: string[] = [];
	const log = newLog();
	const page = () =>
		mentionsPage({
			...styleHost(() => undefined, log),
			mentions: () => settings.mentions,
			clashesOf: (mention) => clashes[mention.id] ?? [],
			openPage: (pageId) => void opened.push(pageId),
			change: (mutate) => Promise.resolve(void mutate()),
		});
	const list = () => (page().items ?? [])[0] as unknown as ItemLike;
	const subPages = () => ((page().items ?? [])[1] as unknown as ItemLike).items ?? [];
	return { page, list, subPages, opened };
}

test("Mentions is a page with one row per mention and a hidden page for each", () => {
	const settings = mergeSettings({ mentions: [{ id: "day", trigger: "@", targets: ["day"] }, { id: "month", trigger: "#", targets: ["month", "year"] }] });
	const { page, list, subPages } = mentions(settings, { month: [{ kind: "builtin", feature: "tags", sequence: "#" }] });
	assert.equal(page().name, "Mentions");
	assert.equal(list().type, "list");
	assert.deepEqual(list().items?.map((row) => row.name), ["@", "#"]);
	assert.equal(list().items?.[0].desc, "Daily notes");
	assert.equal(list().items?.[1].desc, "Monthly notes, Yearly notes. Obsidian suggests tags after #, so this mention does not open there.");
	assert.equal(((page().items ?? [])[1] as unknown as ItemLike).visible, false);
	assert.deepEqual(subPages().map((subPage) => [subPage.id, subPage.name]), [["mention-day", "@"], ["mention-month", "#"]]);
	assert.deepEqual(pagePath([{ type: "group", items: [page()] }], "mention-month"), ["mentions", "mention-month"]);
});

test("the page of a mention has its trigger first, then its link style, and flags a clashing trigger", () => {
	const settings = mergeSettings({ mentions: [{ id: "day", trigger: "@" }, { id: "tag", trigger: "#" }] });
	const { subPages } = mentions(settings, { tag: [{ kind: "builtin", feature: "tags", sequence: "#" }] });
	const [plain, clashing] = subPages();
	assert.deepEqual(controlKeysOf(plain.items ?? []), ["trigger", "template", "linkPath", "separator", "aliasShape"].map((field) => `mentions/day/${field}`));
	assert.deepEqual(plain.items?.map((item) => item.heading), [undefined, "Target periods", "Links", "Link text"]);
	assert.deepEqual(plain.items?.[0].items?.map((item) => item.name), ["Trigger"]);
	assert.match(plain.items?.[0].items?.[0].desc ?? "", /are not checked/);
	assert.equal(plain.status?.(), null);
	assert.deepEqual(clashing.items?.[0].items?.map((item) => item.name), ["Trigger", "This trigger clashes"]);
	assert.equal(clashing.items?.[0].items?.[1].desc, "Obsidian suggests tags after #, so this mention does not open there.");
	assert.equal(clashing.status?.(), "warning");
});

test("the Mentions page adds a mention on an unused trigger and opens it, and reorders and removes mentions", async () => {
	const settings = defaultSettings();
	const { list, subPages, opened } = mentions(settings);
	list().addItem?.action({} as HTMLElement);
	await Promise.resolve();
	assert.deepEqual(settings.mentions.map((mention) => [mention.id, mention.trigger]), [["mention-1", "@"], ["mention-2", "@@"]]);
	assert.deepEqual(opened, ["mention-mention-2"]);
	assert.equal(subPages().length, 2);
	list().onReorder?.(1, 0);
	assert.deepEqual(settings.mentions.map((mention) => mention.trigger), ["@@", "@"]);
	list().onDelete?.(0);
	list().onDelete?.(0);
	assert.equal(settings.mentions.length, 0);
	assert.equal(list().emptyState, "No mentions yet. Add one to link date notes while typing.");
	list().addItem?.action({} as HTMLElement);
	assert.deepEqual(settings.mentions.map((mention) => mention.trigger), ["@"]);
});

interface LanguageListLike {
	type: string;
	heading: string;
	items: Array<{ name: string; desc?: string }>;
	onReorder?: (from: number, to: number) => void;
	onDelete?: (position: number) => void;
	addItem?: { name: string; action: (anchor: HTMLElement) => void };
}

function localization(settings: DateCompassSettings, written: Array<[string, unknown]> = [], notices: string[] = [], offered: string[][] = []) {
	const context: LocalizationPageContext = {
		...sampleHost(written),
		languages: () => settings.languages,
		dayMonthOrder: () => settings.dayMonthOrder,
		changeLanguages: (languages: ParserLanguage[]) => void (settings.languages = languages),
		chooseLanguage: (_anchor: HTMLElement, choices: LanguageChoice[], pick: (language: ParserLanguage) => void) => {
			offered.push(choices.map((choice) => choice.name));
			pick(choices[0].language);
		},
		notify: (message: string) => void notices.push(message),
	};
	const page = () => localizationPage(context);
	const languages = () => (page().items ?? [])[1] as unknown as LanguageListLike;
	const reading = () => ((page().items ?? [])[0] as unknown as { items: unknown[] }).items;
	return { page, languages, reading };
}

test("Localization is a page of its own with the reading settings and then the language list", () => {
	const { page, languages, reading } = localization(mergeSettings({ languages: ["es", "en"] }));
	assert.equal(page().name, "Localization");
	assert.deepEqual(pagePath([{ type: "group", items: [page()] }], "localization"), ["localization"]);
	assert.equal(languages().type, "list");
	assert.equal(languages().heading, "Supported languages");
	assert.deepEqual(languages().items.map((row) => row.name), ["Spanish", "English"]);
	assert.match(languages().items[0].desc ?? "", /wins/);
	assert.equal(languages().items[1].desc, undefined);
	assert.deepEqual(reading().map((item) => (item as { name: string }).name), ["Week starts on", "\"Next\" weekday means", "Read typed dates like"]);
});

test("the language list always offers add and remove, asking which language to add and refusing to drop the last one", () => {
	const settings = mergeSettings({ languages: ["es", "en"] });
	const notices: string[] = [];
	const offered: string[][] = [];
	const { languages } = localization(settings, [], notices, offered);
	languages().addItem?.action({} as HTMLElement);
	assert.deepEqual(settings.languages, ["es", "en"]);
	assert.deepEqual(notices, ["Every supported language is already listed."]);
	languages().onDelete?.(0);
	assert.deepEqual(settings.languages, ["en"]);
	assert.equal(languages().items[0].desc, undefined);
	assert.equal(languages().addItem?.name, "Add language");
	languages().onDelete?.(0);
	assert.deepEqual(settings.languages, ["en"]);
	assert.deepEqual(notices, ["Every supported language is already listed.", "Keep at least one language."]);
	languages().addItem?.action({} as HTMLElement);
	assert.deepEqual(offered, [["Spanish"]]);
	assert.deepEqual(settings.languages, ["en", "es"]);
	languages().onDelete?.(1);
	assert.deepEqual(settings.languages, ["en"]);
});

test("dragging a language changes which one wins shared words", () => {
	const settings = mergeSettings({ languages: ["es", "en"] });
	const { languages } = localization(settings);
	languages().onReorder?.(1, 0);
	assert.deepEqual(settings.languages, ["en", "es"]);
	assert.deepEqual(languages().items.map((row) => row.name), ["English", "Spanish"]);
	assert.match(languages().items[0].desc ?? "", /wins/);
});

test("the typed date order offers Day/Month and Month/Day and shows today in the chosen order", () => {
	const settings = defaultSettings();
	const written: Array<[string, unknown]> = [];
	const { reading } = localization(settings, written);
	const row = renderedRow(renderOf(reading(), "Read typed dates like"));
	assert.deepEqual(row.field.options, { dayMonth: "Day/Month", monthDay: "Month/Day" });
	assert.equal(row.field.value, "dayMonth");
	assert.equal(row.shown(), "Today: 17/11");
	row.pick("monthDay");
	assert.equal(row.shown(), "Today: 11/17");
	row.pick("yearFirst");
	assert.equal(row.shown(), "Today: 11/17");
	assert.deepEqual(written, [["dayMonthOrder", "monthDay"]]);
	assert.equal(mergeSettings({ dayMonthOrder: "monthDay" }).dayMonthOrder, "monthDay");
});

test("the typed date order reads Día/Mes and Mes/Día in Spanish", () => {
	try {
		setLanguage("es");
		const { reading } = localization(defaultSettings());
		const row = renderedRow(renderOf(reading(), "Leer fechas escritas como"));
		assert.deepEqual(row.field.options, { dayMonth: "Día/Mes", monthDay: "Mes/Día" });
		assert.equal(row.shown(), "Hoy: 17/11");
	} finally {
		setLanguage(DEFAULT_LANGUAGE);
	}
});

test("the stored language order survives a load, and repeated or unknown languages are dropped", () => {
	assert.deepEqual(mergeSettings({ languages: ["es", "en"] }).languages, ["es", "en"]);
	assert.deepEqual(mergeSettings({ languages: ["en", "es", "en", "fr"] }).languages, ["en", "es"]);
});
