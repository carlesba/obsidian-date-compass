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

function dayNote(isoDate: string): NoteRef {
	const start = moment(isoDate, "YYYY-MM-DD");
	return { period: "day", start, date: start, name: isoDate, path: `daily/${isoDate}.md` };
}

const NOTES = [dayNote("2026-11-23"), dayNote("2026-11-24"), dayNote("2026-11-25")];

const obsidianLink = (note: NoteRef, alias: string | undefined) => (alias === undefined ? `[[${note.name}]]` : `[[${note.name}|${alias}]]`);

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

test("the default template and separator write one link and a comma-separated list", () => {
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
