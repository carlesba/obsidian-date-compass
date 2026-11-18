import { test } from "node:test";
import { strict as assert } from "node:assert";
import { decoratorOf, filterProblem, filtersLinkingNotes, linkingNoteMatcher, mergeDecorators } from "../src/calendar/decorators.ts";
import type { DotDecorator } from "../src/calendar/decorators.ts";
import type { FilterGroup, FilterNode } from "../src/filters/filters.ts";
import { matchesLegacyFilters, migrateLegacyFilters, readLegacyFilters } from "../src/filters/legacy.ts";
import type { LegacyFilter, LegacyNote } from "../src/filters/legacy.ts";
import { decoratorSummary, decoratorWarning } from "../src/settings/calendarPage.ts";
import { NOW, fakeFilterVault, noteOf } from "./fakeFilterVault.ts";
import type { FakeNote } from "./fakeFilterVault.ts";
import { moment } from "./moment.ts";

const all = (...items: FilterNode[]): FilterGroup => ({ kind: "group", mode: "all", items });
const hasTag = (value: string): FilterNode => ({ kind: "file", field: "file", condition: { operator: "has tag", value } });
const pathStartsWith = (value: string): FilterNode => ({ kind: "file", field: "path", condition: { operator: "starts with", value } });
const fullNameStartsWith = (value: string): FilterNode => ({ kind: "file", field: "fullname", condition: { operator: "starts with", value } });

const notes: FakeNote[] = [
	{ path: "Meetings/Team sync.md", tags: ["#work/meeting"], frontmatter: { type: "meeting", people: ["Ana", "Luis"], empty: "" } },
	{ path: "Meetings/2026/1-1 Ana.md", tags: ["#Work"], frontmatter: { Type: "Call" } },
	{ path: "Projects/Roadmap.md", tags: ["#workshop"], frontmatter: { type: "plan" } },
	{ path: "2026 goals.md" },
];

function linksOf(stored: Record<string, unknown>): DotDecorator {
	return mergeDecorators([{ id: "dots-1", source: "links", ...stored }], undefined)[0];
}

function counted(decorator: DotDecorator): string[] {
	const vault = fakeFilterVault(notes);
	const matches = linkingNoteMatcher(decorator, { vault, propertyTypes: {}, today: moment(NOW) });
	return notes.map(noteOf).filter(matches).map((note) => note.basename);
}

function countedBefore(filters: LegacyFilter[]): string[] {
	return notes
		.filter((fake) => matchesLegacyFilters({ path: fake.path, tags: fake.tags ?? [], frontmatter: fake.frontmatter }, filters))
		.map((fake) => noteOf(fake).basename);
}

test("filters of the earlier version match as they did: prefixes in any case, nested tags, a property with or without a value", () => {
	const note: LegacyNote = { path: "Meetings/Team sync.md", tags: ["#work/meeting"], frontmatter: { type: "meeting", people: ["Ana", "Luis"], empty: "" } };
	assert.equal(matchesLegacyFilters(note, []), true);
	assert.equal(matchesLegacyFilters(note, [{ kind: "pathStartsWith", value: "meetings/" }]), true);
	assert.equal(matchesLegacyFilters(note, [{ kind: "pathStartsWith", value: "Projects/" }]), false);
	assert.equal(matchesLegacyFilters(note, [{ kind: "nameStartsWith", value: "team" }]), true);
	assert.equal(matchesLegacyFilters(note, [{ kind: "nameStartsWith", value: "Meetings" }]), false);
	assert.equal(matchesLegacyFilters(note, [{ kind: "tag", value: "work" }]), true);
	assert.equal(matchesLegacyFilters(note, [{ kind: "tag", value: "#work/meeting" }]), true);
	assert.equal(matchesLegacyFilters(note, [{ kind: "tag", value: "wor" }]), false);
	assert.equal(matchesLegacyFilters(note, [{ kind: "property", value: "type" }]), true);
	assert.equal(matchesLegacyFilters(note, [{ kind: "property", value: "empty" }]), false);
	assert.equal(matchesLegacyFilters(note, [{ kind: "property", value: "type: Meeting" }]), true);
	assert.equal(matchesLegacyFilters(note, [{ kind: "property", value: "people: luis" }]), true);
	assert.equal(matchesLegacyFilters(note, [{ kind: "property", value: "type: call" }]), false);
	assert.equal(matchesLegacyFilters(note, [{ kind: "tag", value: "work" }, { kind: "property", value: "type: call" }]), false);
	assert.equal(matchesLegacyFilters(note, [{ kind: "tag", value: " " }]), true);
	assert.equal(matchesLegacyFilters({ path: "a.md", tags: [], frontmatter: undefined }, [{ kind: "property", value: "type" }]), false);
});

test("an earlier tag filter becomes a has tag condition", () => {
	assert.deepEqual(migrateLegacyFilters([{ kind: "tag", value: " #Work " }]), { rules: [hasTag("#Work")], kept: [] });
	for (const value of ["work", "#WORK", "work/meeting", "wor", "#"]) {
		const migrated = linksOf({ filters: [{ kind: "tag", value }] });
		assert.deepEqual(migrated.legacyFilters, []);
		assert.deepEqual(counted(migrated), countedBefore([{ kind: "tag", value }]), value);
	}
});

test("an earlier path or name prefix becomes a starts with condition only when letter case cannot change what it matches", () => {
	assert.deepEqual(migrateLegacyFilters([{ kind: "pathStartsWith", value: " /2026 " }]), { rules: [pathStartsWith("2026")], kept: [] });
	assert.deepEqual(migrateLegacyFilters([{ kind: "nameStartsWith", value: "1-1 " }]), { rules: [fullNameStartsWith("1-1")], kept: [] });
	assert.deepEqual(counted(linksOf({ filters: [{ kind: "pathStartsWith", value: "/2026" }] })), ["2026 goals"]);
	assert.deepEqual(counted(linksOf({ filters: [{ kind: "nameStartsWith", value: "1-1" }] })), ["1-1 Ana"]);
	const cased: LegacyFilter[] = [
		{ kind: "pathStartsWith", value: "meetings/" },
		{ kind: "nameStartsWith", value: "team" },
	];
	assert.deepEqual(migrateLegacyFilters(cased), { rules: [], kept: cased });
});

test("an earlier property filter is kept as it is, because property names and values were read in any case", () => {
	const filters: LegacyFilter[] = [
		{ kind: "property", value: "type" },
		{ kind: "property", value: "type: call" },
	];
	assert.deepEqual(migrateLegacyFilters(filters), { rules: [], kept: filters });
});

test("an earlier filter without a value matched every note, so it is left out", () => {
	const empty: LegacyFilter[] = [
		{ kind: "pathStartsWith", value: " / " },
		{ kind: "nameStartsWith", value: "" },
		{ kind: "tag", value: "  " },
		{ kind: "property", value: "" },
	];
	assert.deepEqual(migrateLegacyFilters(empty), { rules: [], kept: [] });
	const merged = linksOf({ filters: empty });
	assert.deepEqual([merged.filter, merged.legacyFilters, filterProblem(merged), filtersLinkingNotes(merged)], [all(), [], undefined, false]);
	assert.deepEqual(counted(merged), countedBefore(empty));
});

test("dots saved by the earlier version count the same notes: what converts moves into the filter, the rest stays and warns", () => {
	const saved: LegacyFilter[] = [
		{ kind: "pathStartsWith", value: "meetings/" },
		{ kind: "nameStartsWith", value: "1-1" },
		{ kind: "tag", value: "work" },
		{ kind: "property", value: "type: call" },
	];
	const merged = linksOf({ filters: saved });
	assert.deepEqual(merged.filter, all(fullNameStartsWith("1-1"), hasTag("work")));
	assert.deepEqual(merged.legacyFilters, [saved[0], saved[3]]);
	assert.equal("filters" in merged, false);
	assert.deepEqual(counted(merged), ["1-1 Ana"]);
	assert.deepEqual(counted(merged), countedBefore(saved));
	assert.equal(filterProblem(merged), "legacy");
	assert.match(decoratorWarning(merged, {}) ?? "", /earlier version still apply.*Remove them and build them again/);
	assert.match(decoratorSummary(merged), /matching notes only/);
	const reloaded = mergeDecorators(JSON.parse(JSON.stringify([merged])), undefined)[0];
	assert.deepEqual(reloaded, merged);
	for (const filters of saved.map((filter) => [filter])) assert.deepEqual(counted(linksOf({ filters })), countedBefore(filters), filters[0].kind);
});

test("kept earlier filters narrow the notes on top of the filter, whatever the filter's mode", () => {
	const kept: LegacyFilter[] = [{ kind: "pathStartsWith", value: "meetings/" }];
	const anyTag: FilterGroup = { kind: "group", mode: "any", items: [hasTag("workshop"), hasTag("work/meeting")] };
	const merged = linksOf({ filter: anyTag, legacyFilters: [...kept, { kind: "tag", value: "work" }] });
	assert.deepEqual([merged.filter, merged.legacyFilters], [anyTag, [...kept, { kind: "tag", value: "work" }]]);
	assert.deepEqual(counted(merged), ["Team sync"]);
	assert.deepEqual(counted({ ...merged, legacyFilters: [] }), ["Team sync", "Roadmap"]);
});

test("a stored filter of this version merges as saved, and an absent one counts every linking note", () => {
	const filter = all(hasTag("work"), { kind: "group", mode: "none", items: [{ kind: "property", property: "type", condition: { operator: "is", value: "meeting" } }] });
	const merged = linksOf({ filter });
	assert.deepEqual([merged.filter, merged.legacyFilters, merged.unreadableFilter, filterProblem(merged)], [filter, [], undefined, undefined]);
	assert.deepEqual(counted(merged), ["1-1 Ana"]);
	assert.equal(filtersLinkingNotes(merged), true);
	const unfiltered = linksOf({});
	assert.deepEqual(unfiltered.filter, all());
	assert.equal(counted(unfiltered).length, notes.length);
	assert.equal(filtersLinkingNotes(unfiltered), false);
	assert.deepEqual(decoratorOf("links", "dots-9").filter, all());
});

test("a stored filter that cannot be read stays saved, counts no note and warns until it is removed", () => {
	const unreadable: Record<string, unknown>[] = [
		{ filter: { kind: "group", mode: "sometimes", items: [] } },
		{ filter: all({ kind: "colour", colour: "red" } as unknown as FilterNode) },
		{ filter: "work" },
		{ filters: [{ kind: "regex", value: "x" }] },
		{ filters: [{ kind: "tag" }] },
		{ filters: "tag" },
		{ legacyFilters: [{ kind: "tag", value: 3 }] },
	];
	for (const stored of unreadable) {
		const merged = linksOf(stored);
		assert.deepEqual(merged.unreadableFilter, Object.values(stored)[0], JSON.stringify(stored));
		assert.deepEqual([merged.filter, merged.legacyFilters], [all(), []]);
		assert.equal(filterProblem(merged), "unreadable");
		assert.deepEqual(counted(merged), []);
		assert.match(decoratorWarning(merged, {}) ?? "", /can't be read.*Remove it and build it again/);
		assert.equal(filtersLinkingNotes(merged), true);
		assert.deepEqual(mergeDecorators(JSON.parse(JSON.stringify([merged])), undefined)[0], merged);
	}
	const removed = linksOf({ filter: "work" });
	delete removed.unreadableFilter;
	assert.equal(filterProblem(removed), undefined);
	assert.equal(counted(removed).length, notes.length);
});

test("dots that do not count linking notes carry no filter and never warn", () => {
	const [words] = mergeDecorators([{ id: "dots-1", source: "words", filters: [{ kind: "regex", value: "x" }], filter: "work" }], undefined);
	assert.deepEqual([words.filter, words.legacyFilters, words.unreadableFilter], [all(), [], undefined]);
	assert.equal(decoratorWarning(words, {}), undefined);
});

test("a condition that does not apply to its property's type warns on the dots", () => {
	const merged = linksOf({ filter: all({ kind: "property", property: "rating", condition: { operator: "contains", value: "3" } }) });
	assert.equal(decoratorWarning(merged, {}), undefined);
	assert.equal(decoratorWarning(merged, { rating: "number" }), "A filter condition does not apply. Edit to see why.");
});

test("only well-formed earlier filters are read", () => {
	assert.deepEqual(readLegacyFilters([{ kind: "tag", value: "x", extra: 1 }]), [{ kind: "tag", value: "x" }]);
	assert.deepEqual(readLegacyFilters([]), []);
	for (const stored of [undefined, {}, [{ kind: "tag" }], [{ kind: "folder", value: "x" }], ["tag"]]) assert.equal(readLegacyFilters(stored), undefined);
});
