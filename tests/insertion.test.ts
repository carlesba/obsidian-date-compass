import { test } from "node:test";
import { strict as assert } from "node:assert";
import { moment } from "./moment.ts";
import type { NoteRef } from "../src/mentions/rows.ts";
import { MORE_ROW, selectionIntent, withMoreRow } from "../src/mentions/selection.ts";
import { aliasFor, formattedItems, insertionLinks, insertionText, renderLink, usesAlias } from "../src/insertion/render.ts";
import { mergeInsertion } from "../src/insertion/settings.ts";
import { chooseDestination, effectiveDestination, propertyAtLine } from "../src/insertion/destination.ts";
import { propertyWithLinks } from "../src/insertion/property.ts";
import { mergeSettings } from "../src/settings.ts";
import { v1AliasOf, v1InsertionText, v1SequenceInsertion } from "./v1Insertion.ts";
import type { V1AliasMode, V1Layout, V1Separator } from "./v1Insertion.ts";

function dayNote(isoDate: string): NoteRef {
	const start = moment(isoDate, "YYYY-MM-DD");
	return { period: "day", start, date: start, name: isoDate, path: `daily/${isoDate}.md` };
}

const NOTES = [dayNote("2026-11-23"), dayNote("2026-11-24"), dayNote("2026-11-25")];

const obsidianLink = (note: NoteRef, alias: string | undefined) => (alias === undefined ? `[[${note.name}]]` : `[[${note.name}|${alias}]]`);

const ALIAS_MODES: V1AliasMode[] = ["none", "typed", "format"];
const SEPARATORS: V1Separator[] = ["commaSpace", "space", "bulletLines"];
const LAYOUTS: V1Layout[] = ["inline", "bulletList", "linePerItem"];
const TEXTS_BEFORE = ["", "Due ", "  ", "  - ", "1. "];

test("a template renders the link, name, path, alias and a formatted date", () => {
	const [note] = NOTES;
	const parts = { link: "[[2026-11-23|Mon]]", note, alias: "Mon" };
	assert.equal(renderLink("{{link}}", parts), "[[2026-11-23|Mon]]");
	assert.equal(renderLink("- [ ] {{name}} ({{path}}) {{alias}} {{date:ddd D MMM}}", parts), "- [ ] 2026-11-23 (daily/2026-11-23.md) Mon Mon 23 Nov");
	assert.equal(renderLink("{{unknown}} {{alias}}", { ...parts, alias: undefined }), "{{unknown}} ");
	assert.equal(renderLink("{{link}}{{link}}", { ...parts, link: "{{name}}" }), "{{name}}{{name}}");
});

test("the alias is the typed phrase for one date, a date format otherwise, and only when asked for", () => {
	const typed = { aliasShape: "typed" as const, aliasFormat: "D MMM" };
	assert.equal(aliasFor(typed, "tomorrow", NOTES.slice(0, 1), NOTES[0]), "tomorrow");
	assert.equal(aliasFor(typed, "mon to wed", NOTES, NOTES[0]), undefined);
	assert.equal(aliasFor({ aliasShape: "format", aliasFormat: "D MMM" }, "x", NOTES, NOTES[1]), "24 Nov");
	const insertion = mergeInsertion({ aliasShape: "format", aliasFormat: "D MMM", aliasByDefault: false });
	assert.deepEqual(insertionLinks(NOTES.slice(0, 2), "x", insertion, false, obsidianLink), ["[[2026-11-23]]", "[[2026-11-24]]"]);
	assert.deepEqual(insertionLinks(NOTES.slice(0, 2), "x", insertion, true, obsidianLink), ["[[2026-11-23|23 Nov]]", "[[2026-11-24|24 Nov]]"]);
});

test("the alias flip inverts the default for one insert", () => {
	assert.equal(usesAlias({ aliasByDefault: false }, false), false);
	assert.equal(usesAlias({ aliasByDefault: false }, true), true);
	assert.equal(usesAlias({ aliasByDefault: true }, false), true);
	assert.equal(usesAlias({ aliasByDefault: true }, true), false);
});

test("links are placed with the chosen separator in the list they are typed in", () => {
	const links = ["[[a]]", "[[b]]"];
	assert.equal(insertionText(links, "commaSpace", "meet "), "[[a]], [[b]]");
	assert.equal(insertionText(links, "space", "meet "), "[[a]] [[b]]");
	assert.equal(insertionText(links, "bulletLines", ""), "- [[a]]\n- [[b]]");
	assert.equal(insertionText(links, "bulletLines", "  "), "- [[a]]\n  - [[b]]");
	assert.equal(insertionText(links, "bulletLines", "  - "), "[[a]]\n  - [[b]]");
	assert.equal(insertionText(links, "bulletLines", "1. "), "[[a]]\n- [[b]]");
	assert.equal(insertionText(links, "bulletLines", "meet "), "\n- [[a]]\n- [[b]]");
	assert.equal(insertionText(["[[a]]"], "bulletLines", "meet "), "[[a]]");
	assert.equal(insertionText(["[[a]]"], "lines", "Due "), "[[a]]");
	assert.equal(insertionText(links, "lines", ""), "[[a]]\n[[b]]");
	assert.equal(insertionText(links, "lines", "  Due "), "\n  [[a]]\n  [[b]]");
});

test("action items go through the link template with the formatted item as the link", () => {
	assert.deepEqual(formattedItems(["x", "y"], NOTES, "- {{link}} {{name}}"), ["- x 2026-11-23", "- y 2026-11-24"]);
});

test("settings without any stored insertion load the defaults, and unknown keys are ignored", () => {
	const defaults = { linkPath: "shortestWhenSafe", linkTemplate: "{{link}}", separator: "commaSpace", aliasShape: "format", aliasFormat: "ddd D MMM", aliasByDefault: false };
	assert.deepEqual(mergeSettings(undefined).insertion, defaults);
	assert.deepEqual(mergeSettings({ insertion: { linkTemplate: " ", separator: "tab", extra: 1 }, other: true }).insertion, defaults);
	assert.deepEqual(mergeSettings({ mentions: { enabled: true, surprise: 1 }, insertSequence: "broken" }).insertion, defaults);
});

test("a v1 data.json migrates field by field", () => {
	const migrated = (mentions: object, insertSequence?: object) => mergeSettings({ mentions, insertSequence }).insertion;
	assert.deepEqual(migrated({ aliasMode: "none", aliasFormat: "D MMM", separator: "space" }), { linkPath: "shortestWhenSafe", linkTemplate: "{{link}}", separator: "space", aliasShape: "format", aliasFormat: "D MMM", aliasByDefault: false });
	assert.equal(migrated({ aliasMode: "typed" }).aliasShape, "typed");
	assert.equal(migrated({ aliasMode: "typed" }).aliasByDefault, true);
	assert.equal(migrated({ aliasMode: "format" }).aliasByDefault, true);
	assert.equal(migrated({ aliasFormat: "  " }).aliasFormat, "ddd D MMM");
	assert.equal(migrated({ separator: "space" }, { layout: "bulletList" }).separator, "bulletLines");
	assert.equal(migrated({ separator: "space" }, { layout: "linePerItem" }).separator, "lines");
	assert.equal(migrated({ separator: "bulletLines" }, { layout: "inline" }).separator, "bulletLines");
	assert.equal(migrated({}, { itemTemplate: "Review {{link}}" }).linkTemplate, "Review {{link}}");
	assert.equal(migrated({}, { itemTemplate: "no link" }).linkTemplate, "{{link}}");
});

test("migrating twice, or migrating already migrated data, changes nothing", () => {
	const v1 = { weekStart: "monday", mentions: { aliasMode: "typed", aliasFormat: "D MMM", separator: "space" }, insertSequence: { layout: "linePerItem", itemTemplate: "- {{link}}" } };
	const once = mergeSettings(v1);
	const twice = mergeSettings(JSON.parse(JSON.stringify(once)));
	assert.deepEqual(twice, once);
	assert.equal("aliasMode" in twice.mentions, false);
	assert.equal("insertSequence" in twice, false);
	const afterEdit = mergeSettings({ ...JSON.parse(JSON.stringify(once)), mentions: { aliasMode: "none", separator: "commaSpace" } });
	assert.deepEqual(afterEdit.insertion, once.insertion);
});

test("a migrated v1 popup mention inserts the same string as v1 for every alias mode, format and separator", () => {
	for (const aliasMode of ALIAS_MODES) {
		for (const aliasFormat of ["ddd D MMM", "D/M"]) {
			for (const separator of SEPARATORS) {
				for (const textBefore of TEXTS_BEFORE) {
					for (const notes of [NOTES.slice(0, 1), NOTES]) {
						const v1Mentions = { aliasMode, aliasFormat, separator };
						const row = { text: "mon to wed", notes };
						const v1Links = notes.map((note) => obsidianLink(note, v1AliasOf(row, note, v1Mentions)));
						const { insertion } = mergeSettings({ mentions: v1Mentions });
						const links = insertionLinks(notes, row.text, insertion, usesAlias(insertion, false), obsidianLink);
						assert.equal(insertionText(links, insertion.separator, textBefore), v1InsertionText(v1Links, separator, textBefore), JSON.stringify({ v1Mentions, textBefore, count: notes.length }));
					}
				}
			}
		}
	}
});

test("a migrated v1 Insert date sequence inserts the same string as v1 for every layout, separator and item template", () => {
	for (const layout of LAYOUTS) {
		for (const itemTemplate of ["{{link}}", "- [ ] review {{link}} ({{link}})", "on {{link}}"]) {
			for (const separator of SEPARATORS) {
				for (const textBefore of TEXTS_BEFORE) {
					for (const notes of [NOTES.slice(0, 2), NOTES]) {
						const v1Links = notes.map((note) => obsidianLink(note, undefined));
						const expected = v1SequenceInsertion(v1Links, { layout, itemTemplate }, separator, textBefore);
						const { insertion } = mergeSettings({ mentions: { separator }, insertSequence: { layout, itemTemplate } });
						const links = insertionLinks(notes, "mon to wed", insertion, false, obsidianLink);
						assert.equal(insertionText(links, insertion.separator, textBefore), expected, JSON.stringify({ layout, itemTemplate, separator, textBefore, count: notes.length }));
					}
				}
			}
		}
	}
});

test("the default template and separator write one link and a comma-separated list as v1 did", () => {
	const { insertion } = mergeSettings({});
	assert.equal(insertionText(insertionLinks(NOTES, "x", insertion, false, obsidianLink), insertion.separator, "Due "), "[[2026-11-23]], [[2026-11-24]], [[2026-11-25]]");
});

const NOTE_WITH_PROPERTIES = ["---", "title: Trip", "dates:", "  - 2026-11-01", "  - 2026-11-02", "status: open", "---", "Body text"];

test("the cursor in the frontmatter names the property whose value it is in", () => {
	assert.equal(propertyAtLine(NOTE_WITH_PROPERTIES, 1), "title");
	assert.equal(propertyAtLine(NOTE_WITH_PROPERTIES, 2), "dates");
	assert.equal(propertyAtLine(NOTE_WITH_PROPERTIES, 4), "dates");
	assert.equal(propertyAtLine(NOTE_WITH_PROPERTIES, 5), "status");
	assert.equal(propertyAtLine(["---", "\"due date\": x", "---"], 1), "due date");
	assert.equal(propertyAtLine(NOTE_WITH_PROPERTIES, 0), undefined);
	assert.equal(propertyAtLine(NOTE_WITH_PROPERTIES, 6), undefined);
	assert.equal(propertyAtLine(NOTE_WITH_PROPERTIES, 7), undefined);
});

test("dates go to the property under the cursor in the frontmatter and to the body anywhere else", () => {
	const state = (cursorLine: number, focusedProperty?: string, lines = NOTE_WITH_PROPERTIES) => ({ lines, cursorLine, focusedProperty });
	assert.deepEqual(chooseDestination(state(4)), { kind: "property", name: "dates" });
	assert.deepEqual(chooseDestination(state(7)), { kind: "body" });
	assert.deepEqual(chooseDestination(state(0)), { kind: "body" });
	assert.deepEqual(chooseDestination(state(6)), { kind: "body" });
	assert.deepEqual(chooseDestination(state(7, "dates")), { kind: "property", name: "dates" });
	assert.deepEqual(chooseDestination(state(7, "")), { kind: "body" });
	assert.deepEqual(chooseDestination(state(1, undefined, ["---", "", "---"])), { kind: "frontmatterWithoutProperty" });
	assert.deepEqual(chooseDestination(state(1, undefined, ["---", "no closing fence", "Body"])), { kind: "body" });
	assert.deepEqual(chooseDestination(state(0, undefined, [])), { kind: "body" });
});

test("the More row is always last and Enter, Alt+Enter and Shift+Enter pick what to do", () => {
	const row = { source: "interpretation" as const, text: "x", language: "en", notes: [NOTES[0]] };
	assert.deepEqual(withMoreRow([]), [MORE_ROW]);
	assert.deepEqual(withMoreRow([row, row]).at(-1), MORE_ROW);
	assert.equal(selectionIntent(row, { altKey: false, shiftKey: false }), "insert");
	assert.equal(selectionIntent(row, { altKey: true, shiftKey: false }), "insertFlippingAlias");
	assert.equal(selectionIntent(row, { altKey: false, shiftKey: true }), "openDatesModal");
	assert.equal(selectionIntent(MORE_ROW, { altKey: true, shiftKey: false }), "openDatesModal");
});

test("a nested key is not a property destination, and a list under it is not either", () => {
	const nested = ["---", "meta:", "  due: x", "  days:", "    - a", "top: y", "---", "Body"];
	assert.equal(propertyAtLine(nested, 1), "meta");
	assert.equal(propertyAtLine(nested, 2), undefined);
	assert.equal(propertyAtLine(nested, 4), undefined);
	assert.equal(propertyAtLine(nested, 5), "top");
	assert.deepEqual(chooseDestination({ lines: nested, cursorLine: 2, focusedProperty: undefined }), { kind: "frontmatterWithoutProperty" });
});

test("a property destination without a file becomes body insertion", () => {
	assert.deepEqual(effectiveDestination({ kind: "property", name: "dates" }, false), { kind: "body" });
	assert.deepEqual(effectiveDestination({ kind: "property", name: "dates" }, true), { kind: "property", name: "dates" });
	assert.deepEqual(effectiveDestination({ kind: "frontmatterWithoutProperty" }, false), { kind: "frontmatterWithoutProperty" });
});

test("the property write appends only the missing links and keeps what was there in its order", () => {
	const links = ["[[2026-11-23]]", "[[2026-11-24]]"];
	assert.deepEqual(propertyWithLinks(undefined, links), links);
	assert.deepEqual(propertyWithLinks("2026-11-23", ["[[2026-11-23]]"]), ["2026-11-23", "[[2026-11-23]]"]);
	assert.equal(propertyWithLinks("[[2026-11-23]]", ["[[2026-11-23]]"]), undefined);
	assert.deepEqual(propertyWithLinks("", links), links);
	assert.deepEqual(propertyWithLinks("[[2026-12-01]]", links), ["[[2026-12-01]]", ...links]);
	assert.deepEqual(propertyWithLinks(["[[2026-12-01]]", "b", "[[2026-12-01]]", "[[2026-11-24|Tue]]"], links), ["[[2026-12-01]]", "b", "[[2026-12-01]]", "[[2026-11-24|Tue]]", "[[2026-11-23]]"]);
	assert.deepEqual(propertyWithLinks(["z"], ["[[a]]", "[[a]]"]), ["z", "[[a]]"]);
	const mapping = { due: "x" };
	assert.deepEqual(propertyWithLinks(mapping, links), [mapping, ...links]);
});

const TWO = NOTES.slice(0, 2);
const aliasedLink = (note: NoteRef, alias: string | undefined) => (alias === undefined ? `[[${note.name}]]` : `[[${note.name}|${alias}]]`);
const v2Text = (stored: object, notes: NoteRef[], textBefore: string, withAlias: boolean) => {
	const { insertion } = mergeSettings(stored);
	return insertionText(insertionLinks(notes, "mon to wed", insertion, withAlias, aliasedLink), insertion.separator, textBefore);
};

test("known difference from v1: a stored format alias now also shows in the modal", () => {
	const stored = { mentions: { aliasMode: "format", aliasFormat: "ddd D MMM" } };
	const v1 = v1SequenceInsertion(TWO.map((note) => aliasedLink(note, undefined)), { layout: "inline", itemTemplate: "{{link}}" }, "commaSpace", "Due ");
	const aliasByDefault = mergeSettings(stored).insertion.aliasByDefault;
	assert.equal(v1, "[[2026-11-23]], [[2026-11-24]]");
	assert.equal(v2Text(stored, TWO, "Due ", aliasByDefault), "[[2026-11-23|Mon 23 Nov]], [[2026-11-24|Tue 24 Nov]]");
});

test("known difference from v1: a stored bullet layout and item template now also shape the popup", () => {
	const stored = { insertSequence: { layout: "bulletList", itemTemplate: "Review {{link}}" } };
	const v1 = v1InsertionText(TWO.map((note) => aliasedLink(note, undefined)), "commaSpace", "Due ");
	assert.equal(v1, "[[2026-11-23]], [[2026-11-24]]");
	assert.equal(v2Text(stored, TWO, "Due ", false), "\n- Review [[2026-11-23]]\n- Review [[2026-11-24]]");
});

test("known difference from v1: the {{name}} placeholder in a stored item template now renders", () => {
	const stored = { insertSequence: { layout: "inline", itemTemplate: "{{name}} {{link}}" } };
	const v1 = v1SequenceInsertion([aliasedLink(NOTES[0], undefined)], { layout: "inline", itemTemplate: "{{name}} {{link}}" }, "commaSpace", "");
	assert.equal(v1, "{{name}} [[2026-11-23]]");
	assert.equal(v2Text(stored, NOTES.slice(0, 1), "", false), "2026-11-23 [[2026-11-23]]");
});

test("known difference from v1: a stored bullet list with one date writes a bare link", () => {
	const stored = { insertSequence: { layout: "bulletList", itemTemplate: "{{link}}" } };
	const v1 = v1SequenceInsertion([aliasedLink(NOTES[0], undefined)], { layout: "bulletList", itemTemplate: "{{link}}" }, "commaSpace", "");
	assert.equal(v1, "- [[2026-11-23]]");
	assert.equal(v2Text(stored, NOTES.slice(0, 1), "", false), "[[2026-11-23]]");
});
