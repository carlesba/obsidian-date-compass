import { test } from "node:test";
import { strict as assert } from "node:assert";
import type { Condition, Operator } from "../src/filters/conditions.ts";
import { MAX_FILTER_DEPTH, emptyFilter, filterRules, noteMatcher, readFilter } from "../src/filters/filters.ts";
import type { FileField, FilterGroup, FilterNode, FilterRule } from "../src/filters/filters.ts";
import { addCondition, addGroup, canAddGroup, changeRuleField, fitRuleToProperty, inapplicableFilter, newRule, operatorOptions, readConditionField, removeNode, writeConditionField, writeMode, writeProperty } from "../src/settings/filterForm.ts";
import { HOURS_AGO, NOW, fakeFilterVault } from "./fakeFilterVault.ts";
import type { FakeNote } from "./fakeFilterVault.ts";
import { moment } from "./moment.ts";

const DAY = 24;

const TYPES = { active: "checkbox" };

const property = (name: string, condition: Condition): FilterRule => ({ kind: "property", property: name, condition });
const isTrue = (name: string) => property(name, { operator: "is", value: true });
const file = (field: FileField, operator: Operator, value?: Condition["value"]): FilterRule => ({
	kind: "file",
	field,
	condition: value === undefined ? { operator } : { operator, value },
});
const inFolder = (folder: string) => file("file", "in folder", folder);
const hasTag = (tag: string) => file("file", "has tag", tag);
const linksTo = (note: string) => file("file", "links to", note);
const all = (...items: FilterNode[]): FilterGroup => ({ kind: "group", mode: "all", items });
const any = (...items: FilterNode[]): FilterGroup => ({ kind: "group", mode: "any", items });
const none = (...items: FilterNode[]): FilterGroup => ({ kind: "group", mode: "none", items });

const notes: FakeNote[] = [
	{ path: "projects/Alpha.md", frontmatter: { active: true, status: "doing" }, tags: ["#work"], ctime: NOW, mtime: HOURS_AGO(1), size: 120, embeds: ["people/Person.md"] },
	{ path: "projects/sub/Beta.md", frontmatter: { active: false }, tags: ["#Work/Client"], ctime: HOURS_AGO(5 * DAY), mtime: HOURS_AGO(3 * DAY), size: 900 },
	{ path: "projectsX/Gamma.md", frontmatter: { active: true }, tags: ["#workshop"], links: ["people/Person.md"], ctime: HOURS_AGO(10 * DAY), size: 40 },
	{ path: "people/Person.md", frontmatter: {}, links: [], ctime: HOURS_AGO(DAY), mtime: HOURS_AGO(DAY) },
	{ path: "Delta.md", frontmatter: { status: "doing" }, links: ["people/Person.md", "projects/Alpha.md"], ctime: HOURS_AGO(2 * DAY) },
];

function listed(filter: FilterGroup): string[] {
	const vault = fakeFilterVault(notes);
	const matches = noteMatcher(filter, { vault, propertyTypes: TYPES, today: moment(NOW) });
	return vault
		.notes()
		.filter(matches)
		.map((note) => note.basename)
		.sort();
}

const EVERY_NOTE = ["Alpha", "Beta", "Delta", "Gamma", "Person"];

test("all, any and none combine a group's conditions", () => {
	assert.deepEqual(listed((all(isTrue("active"), property("status", { operator: "is", value: "doing" })))), ["Alpha"]);
	assert.deepEqual(listed((any(isTrue("active"), property("status", { operator: "is", value: "doing" })))), ["Alpha", "Delta", "Gamma"]);
	assert.deepEqual(listed((none(isTrue("active"), property("status", { operator: "is", value: "doing" })))), ["Beta", "Person"]);
});

test("groups nest inside other groups", () => {
	const nested = all(inFolder("projects"), any(isTrue("active"), hasTag("client"), none(hasTag("work"))));
	assert.deepEqual(listed((nested)), ["Alpha"]);
	const deeper = any(all(hasTag("work"), none(isTrue("active"))), linksTo("Person"));
	assert.deepEqual(listed((deeper)), ["Beta", "Delta", "Gamma"]);
});

test("a filter without any condition matches every note, and an empty group inside a filter is ignored", () => {
	assert.deepEqual(listed((all())), EVERY_NOTE);
	assert.deepEqual(listed((none())), EVERY_NOTE);
	assert.deepEqual(listed((any(all(), none()))), EVERY_NOTE);
	assert.deepEqual(listed((all(isTrue("active"), any()))), ["Alpha", "Gamma"]);
	assert.deepEqual(listed((any(none(), isTrue("active")))), ["Alpha", "Gamma"]);
	assert.deepEqual(listed((none(all(), isTrue("active")))), ["Beta", "Delta", "Person"]);
});

test("file has tag matches the tag and its subtags, with or without #, in any case", () => {
	assert.deepEqual(listed((all(hasTag("work")))), ["Alpha", "Beta"]);
	assert.deepEqual(listed((all(hasTag("#WORK")))), ["Alpha", "Beta"]);
	assert.deepEqual(listed((all(hasTag("work/client")))), ["Beta"]);
	assert.deepEqual(listed((all(hasTag("wor")))), []);
	assert.deepEqual(listed((all(hasTag(" ")))), []);
	assert.deepEqual(listed((all(file("file", "does not have tag", "work")))), ["Delta", "Gamma", "Person"]);
});

test("file in folder matches notes in the folder and its subfolders", () => {
	assert.deepEqual(listed((all(inFolder("projects")))), ["Alpha", "Beta"]);
	assert.deepEqual(listed((all(inFolder("/projects/sub/")))), ["Beta"]);
	assert.deepEqual(listed((all(inFolder("")))), []);
	assert.deepEqual(listed((all(file("file", "is not in folder", "projects")))), ["Delta", "Gamma", "Person"]);
});

test("file links to matches notes linking to the note named by path or name", () => {
	assert.deepEqual(listed((all(linksTo("Person")))), ["Delta", "Gamma"]);
	assert.deepEqual(listed((all(linksTo("people/Person.md")))), ["Delta", "Gamma"]);
	assert.deepEqual(listed((all(linksTo("Nobody")))), []);
	assert.deepEqual(listed((all(file("file", "does not link to", "Person")))), ["Alpha", "Beta", "Person"]);
});

test("file is matches one note, and file has property matches notes that set the property", () => {
	assert.deepEqual(listed((all(file("file", "is", "Delta")))), ["Delta"]);
	assert.deepEqual(listed((all(file("file", "is not", "Delta")))), ["Alpha", "Beta", "Gamma", "Person"]);
	assert.deepEqual(listed((all(file("file", "has property", "status")))), ["Alpha", "Delta"]);
	assert.deepEqual(listed((all(file("file", "does not have property", "active")))), ["Delta", "Person"]);
});

test("file backlinks lists the notes linked from another note, and file links the notes it links to", () => {
	assert.deepEqual(listed((all(file("backlinks", "contains", "Delta")))), ["Alpha", "Person"]);
	assert.deepEqual(listed((all(file("backlinks", "contains", "[[Gamma]]")))), ["Person"]);
	assert.deepEqual(listed((all(file("backlinks", "is empty")))), ["Beta", "Delta", "Gamma"]);
	assert.deepEqual(listed((all(file("links", "contains all of", ["Person", "Alpha"])))), ["Delta"]);
	assert.deepEqual(listed((all(file("links", "contains any of", ["Alpha", "Person"])))), ["Delta", "Gamma"]);
	assert.deepEqual(listed((all(file("links", "is not empty")))), ["Delta", "Gamma"]);
	assert.deepEqual(listed((all(file("embeds", "contains", "Person")))), ["Alpha"]);
});

test("file tags compares whole tags, and file size compares numbers", () => {
	assert.deepEqual(listed((all(file("tags", "contains", "work")))), ["Alpha"]);
	assert.deepEqual(listed((all(file("tags", "contains any of", ["workshop", "work/client"])))), ["Beta", "Gamma"]);
	assert.deepEqual(listed((all(file("size", "≥", 120)))), ["Alpha", "Beta"]);
	assert.deepEqual(listed((all(file("size", "<", 100)))), ["Delta", "Gamma", "Person"]);
});

test("created and modified time compare the note's local day with a fixed or relative date", () => {
	const times = (field: FileField, condition: Condition) => listed((all(file(field, condition.operator, condition.value))));
	assert.deepEqual(times("ctime", { operator: "on", value: { kind: "relative", days: 0 } }), ["Alpha"]);
	assert.deepEqual(times("ctime", { operator: "after", value: { kind: "relative", days: -3 } }), ["Alpha", "Delta", "Person"]);
	assert.deepEqual(times("ctime", { operator: "on or after", value: { kind: "relative", days: -2 } }), ["Alpha", "Delta", "Person"]);
	assert.deepEqual(times("ctime", { operator: "before", value: { kind: "fixed", date: "2024-03-05" } }), ["Beta", "Gamma"]);
	assert.deepEqual(times("ctime", { operator: "on or before", value: { kind: "fixed", date: "2024-03-04" } }), ["Beta", "Gamma"]);
	assert.deepEqual(times("mtime", { operator: "after", value: { kind: "relative", days: -2 } }), ["Alpha", "Person"]);
	assert.deepEqual(times("mtime", { operator: "on", value: { kind: "fixed", date: "2024-03-06" } }), ["Beta"]);
});

test("file name, base name, full name, path, folder and extension are text, matched like Bases", () => {
	const text = (field: FileField, operator: Operator, value?: Condition["value"]) => listed((all(file(field, operator, value))));
	assert.deepEqual(text("name", "starts with", "Al"), ["Alpha"]);
	assert.deepEqual(text("name", "starts with", "al"), []);
	assert.deepEqual(text("name", "does not start with", "Al"), ["Beta", "Delta", "Gamma", "Person"]);
	assert.deepEqual(text("name", "contains", "MM"), ["Gamma"]);
	assert.deepEqual(text("name", "does not contain", "a"), ["Person"]);
	assert.deepEqual(text("name", "ends with", "ta"), ["Beta", "Delta"]);
	assert.deepEqual(text("name", "ends with", "TA"), []);
	assert.deepEqual(text("name", "is", "Delta"), ["Delta"]);
	assert.deepEqual(text("basename", "contains any of", ["alp", "gam"]), ["Alpha", "Gamma"]);
	assert.deepEqual(text("fullname", "is", "Beta.md"), ["Beta"]);
	assert.deepEqual(text("path", "starts with", "projects/"), ["Alpha", "Beta"]);
	assert.deepEqual(text("path", "contains", "/SUB/"), ["Beta"]);
	assert.deepEqual(text("path", "ends with", "sub/Beta.md"), ["Beta"]);
	assert.deepEqual(text("folder", "is", "/"), ["Delta"]);
	assert.deepEqual(text("folder", "contains all of", ["project", "sub"]), ["Beta"]);
	assert.deepEqual(text("ext", "is", "md").length, notes.length);
});

test("a text condition with no value lists nothing, and its negation lists every note", () => {
	assert.deepEqual(listed((all(file("name", "contains", "")))), []);
	assert.deepEqual(listed((all(file("name", "contains any of", [])))), []);
	assert.deepEqual(listed((all(file("name", "does not contain", "")))).length, notes.length);
});

test("a stored filter reads back unchanged", () => {
	const filter = all(
		file("file", "is not in folder", "projects"),
		file("backlinks", "contains", "Delta"),
		file("name", "ends with", "ta"),
		file("size", "≤", 100),
		file("mtime", "after", { kind: "relative", days: -7 }),
		any(property("people", { operator: "contains all of", value: ["Ana", "Bo"] }), none(property("status", { operator: "is not empty" }))),
	);
	assert.deepEqual(readFilter(JSON.parse(JSON.stringify(filter))), filter);
	assert.deepEqual(readFilter(emptyFilter()), emptyFilter());
	assert.equal(MAX_FILTER_DEPTH, 3);
	assert.deepEqual(filterRules(filter).length, 7);
});

test("a stored filter with any node this version cannot read is refused whole", () => {
	const unreadable: unknown[] = [
		undefined,
		"all",
		[],
		{ kind: "group", mode: "some", items: [] },
		{ kind: "group", mode: "all" },
		all(isTrue("active"), { kind: "colour", colour: "red" } as unknown as FilterRule),
		all(property("rating", { operator: "between", value: 3 } as unknown as Condition)),
		all(property("rating", { operator: "is" })),
		all({ kind: "property", condition: { operator: "is empty" } } as unknown as FilterRule),
		all(all(all(all(isTrue("active"))))),
		all({ kind: "file", field: "colour", condition: { operator: "is", value: "x" } } as unknown as FilterRule),
		all(file("size", "is", "x")),
		all(file("name", "contains any of", "x")),
		all({ kind: "tag", tag: "work" } as unknown as FilterRule),
	];
	for (const stored of unreadable) assert.equal(readFilter(stored), undefined, JSON.stringify(stored));
	assert.ok(readFilter(all(all(any(isTrue("active"))))));
});

test("a filter warns about a property condition that does not apply anywhere in it", () => {
	const types = { rating: "number" };
	const nested = all(hasTag("x"), any(property("rating", { operator: "is", value: "3" })));
	assert.match(inapplicableFilter(nested, types) ?? "", /"is" does not apply to a number property/);
	assert.equal(inapplicableFilter(all(property("rating", { operator: ">", value: 3 })), types), undefined);
	assert.deepEqual(listed(all(property("active", { operator: "contains", value: "x" }))), []);
});

test("conditions and groups are added for the picked field, down to the deepest level, and removed again", () => {
	const filter = emptyFilter();
	addCondition(filter, "folder");
	addCondition(filter, "property");
	addGroup(filter, "tags");
	assert.deepEqual(filter, all(file("folder", "contains", ""), property("", { operator: "contains", value: "" }), all(file("tags", "contains", ""))));
	assert.deepEqual(newRule("file"), file("file", "links to", ""));
	assert.deepEqual(newRule("size"), file("size", "=", 0));
	assert.deepEqual(newRule("ctime"), file("ctime", "after", { kind: "relative", days: -7 }));
	assert.deepEqual([canAddGroup(1), canAddGroup(2), canAddGroup(3)], [true, true, false]);
	removeNode(filter, filter.items[1]);
	removeNode(filter, filter.items[1]);
	assert.deepEqual(filter, all(file("folder", "contains", "")));
	writeMode(filter, "none");
	writeMode(filter, "sometimes");
	assert.equal(filter.mode, "none");
});

test("changing a condition's field keeps the condition when it still fits and starts over when it does not", () => {
	const filter = all(file("name", "starts with", "Weekly"));
	changeRuleField(filter, filter.items[0] as FilterRule, "path");
	assert.deepEqual(filter, all(file("path", "starts with", "Weekly")));
	changeRuleField(filter, filter.items[0] as FilterRule, "size");
	assert.deepEqual(filter, all(file("size", "=", 0)));
	changeRuleField(filter, filter.items[0] as FilterRule, "property");
	const rule = filter.items[0];
	assert.deepEqual(rule, property("", { operator: "contains", value: "" }));
	if (rule.kind !== "property") return;
	writeProperty(rule, " rating ");
	fitRuleToProperty(rule, { rating: "number" });
	assert.deepEqual(rule, property("rating", { operator: "=", value: 0 }));
});

test("a condition's operator and value are written in the shape the operator takes", () => {
	const rule = file("name", "contains", "week");
	writeConditionField(rule, "operator", "contains any of", {});
	assert.deepEqual(rule.condition, { operator: "contains any of", value: ["week"] });
	writeConditionField(rule, "texts", "week, month ,", {});
	assert.deepEqual(rule.condition, { operator: "contains any of", value: ["week", "month"] });
	assert.equal(readConditionField(rule, "texts"), "week, month");
	writeConditionField(rule, "operator", "is empty", {});
	assert.deepEqual(rule.condition, { operator: "is empty" });
	writeConditionField(rule, "operator", "=", {});
	assert.deepEqual(rule.condition, { operator: "is empty" });
	const dated = file("mtime", "after", { kind: "relative", days: -7 });
	assert.deepEqual([readConditionField(dated, "dateMode"), readConditionField(dated, "direction"), readConditionField(dated, "days")], ["relative", "ago", 7]);
	writeConditionField(dated, "direction", "fromNow", {});
	writeConditionField(dated, "days", 2, {});
	assert.deepEqual(dated.condition.value, { kind: "relative", days: 2 });
	writeConditionField(dated, "dateMode", "fixed", {});
	writeConditionField(dated, "date", " 2024-03-05 ", {});
	assert.deepEqual(dated.condition, { operator: "after", value: { kind: "fixed", date: "2024-03-05" } });
	const checked = property("active", { operator: "is", value: true });
	writeConditionField(checked, "boolean", false, TYPES);
	assert.deepEqual(checked.condition, { operator: "is", value: false });
	assert.deepEqual(Object.keys(operatorOptions("boolean", "contains")), ["is", "is not", "contains"]);
	assert.equal(operatorOptions("boolean", "contains").contains, "contains (does not apply)");
});
