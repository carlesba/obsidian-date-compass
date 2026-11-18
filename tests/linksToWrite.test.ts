import { test } from "node:test";
import { strict as assert } from "node:assert";
import { moment } from "./moment.ts";
import type { NoteRef } from "../src/mentions/rows.ts";
import { defaultLinkStyle } from "../src/insertion/linkStyle.ts";
import type { LinkStyle } from "../src/insertion/linkStyle.ts";
import { linksToWrite } from "../src/insertion/linksToWrite.ts";
import type { LinkBuilders, LinkDestinationKind } from "../src/insertion/linksToWrite.ts";

function dayNote(isoDate: string): NoteRef {
	const start = moment(isoDate, "YYYY-MM-DD");
	return { period: "day", start, date: start, name: isoDate, path: `daily/${isoDate}.md` };
}

const NOTES = [dayNote("2026-11-23"), dayNote("2026-11-24")];

const LINKS: LinkBuilders = {
	body: (note, alias) => (alias === undefined ? `[${note.name}](${note.path})` : `[${alias}](${note.path})`),
	property: (note, alias) => (alias === undefined ? `[[${note.name}]]` : `[[${note.name}|${alias}]]`),
};

const TASKS: LinkStyle = { ...defaultLinkStyle(), template: "- {{link}} ({{date:YYYY}})", aliasFormat: "D MMM" };

function written(destination: LinkDestinationKind, withAlias: boolean, style = TASKS, notes = NOTES, phrase = "mon to tue"): string[] {
	return linksToWrite({ destination, notes, phrase, style, withAlias, links: LINKS });
}

test("in the note body each link is written through the template", () => {
	assert.deepEqual(written("body", false), ["- [2026-11-23](daily/2026-11-23.md) (2026)", "- [2026-11-24](daily/2026-11-24.md) (2026)"]);
	assert.deepEqual(written("body", true), ["- [23 Nov](daily/2026-11-23.md) (2026)", "- [24 Nov](daily/2026-11-24.md) (2026)"]);
	assert.deepEqual(written("body", true, { ...TASKS, template: "{{link}} as {{alias}}" }), ["[23 Nov](daily/2026-11-23.md) as 23 Nov", "[24 Nov](daily/2026-11-24.md) as 24 Nov"]);
	assert.deepEqual(written("body", false, defaultLinkStyle()), ["[2026-11-23](daily/2026-11-23.md)", "[2026-11-24](daily/2026-11-24.md)"]);
});

test("in a property each link is written bare, whatever the template", () => {
	assert.deepEqual(written("property", false), ["[[2026-11-23]]", "[[2026-11-24]]"]);
	assert.deepEqual(written("property", false, { ...TASKS, template: "{{name}} {{alias}}" }), ["[[2026-11-23]]", "[[2026-11-24]]"]);
});

test("a property link carries an alias only when one is asked for", () => {
	assert.deepEqual(written("property", true), ["[[2026-11-23|23 Nov]]", "[[2026-11-24|24 Nov]]"]);
	assert.deepEqual(written("property", false, { ...TASKS, aliasShape: "typed" }, NOTES.slice(0, 1), "monday"), ["[[2026-11-23]]"]);
});

test("the typed phrase is the alias of a single date only, in both destinations", () => {
	const typed: LinkStyle = { ...TASKS, aliasShape: "typed" };
	assert.deepEqual(written("property", true, typed, NOTES.slice(0, 1), "monday"), ["[[2026-11-23|monday]]"]);
	assert.deepEqual(written("body", true, typed, NOTES.slice(0, 1), "monday"), ["- [monday](daily/2026-11-23.md) (2026)"]);
	assert.deepEqual(written("property", true, typed), ["[[2026-11-23]]", "[[2026-11-24]]"]);
	assert.deepEqual(written("body", true, typed), ["- [2026-11-23](daily/2026-11-23.md) (2026)", "- [2026-11-24](daily/2026-11-24.md) (2026)"]);
});

test("no notes give nothing to write", () => {
	assert.deepEqual(written("body", true, TASKS, []), []);
	assert.deepEqual(written("property", true, TASKS, []), []);
});
