import { test } from "node:test";
import { strict as assert } from "node:assert";
import { PERIODS } from "../src/dateNotes/periods.ts";
import { addTarget, canRemoveTarget, defaultLinkStyle, effectiveTargets, mergeLinkStyle, removeTarget, targetsToAdd } from "../src/insertion/linkStyle.ts";

test("the default link style targets every period and inserts a bare link", () => {
	assert.deepEqual(defaultLinkStyle(), {
		targets: ["day", "week", "month", "quarter", "year"],
		template: "{{link}}",
		linkPath: "shortestWhenSafe",
		separator: "commaSpace",
		aliasShape: "format",
		aliasFormat: "ddd D MMM",
	});
	assert.notEqual(defaultLinkStyle().targets, defaultLinkStyle().targets);
});

test("a stored link style keeps its valid fields and falls back field by field", () => {
	const stored = { targets: ["week", "day"], template: "- {{link}}", linkPath: "fullPath", separator: "lines", aliasShape: "typed", aliasFormat: " D MMM " };
	assert.deepEqual(mergeLinkStyle(stored), { targets: ["week", "day"], template: "- {{link}}", linkPath: "fullPath", separator: "lines", aliasShape: "typed", aliasFormat: "D MMM" });
	assert.deepEqual(mergeLinkStyle({ ...stored, template: "  ", linkPath: "relative", separator: 3, aliasShape: null, aliasFormat: "" }), { ...defaultLinkStyle(), targets: ["week", "day"] });
	assert.deepEqual(mergeLinkStyle({ separator: "space" }), { ...defaultLinkStyle(), separator: "space" });
	for (const notStored of [undefined, null, "x", 3, []]) assert.deepEqual(mergeLinkStyle(notStored), defaultLinkStyle());
});

test("stored targets keep only valid periods once, in their order, and are never empty", () => {
	assert.deepEqual(mergeLinkStyle({ targets: ["year", "day", "year", "decade", 3, "month"] }).targets, ["year", "day", "month"]);
	for (const targets of [[], ["decade"], "day", { day: true }, undefined]) assert.deepEqual(mergeLinkStyle({ targets }).targets, [...PERIODS]);
});

test("the effective targets are the ones enabled in date notes, in the stored order", () => {
	const enabled = new Set(["day", "month", "year"]);
	assert.deepEqual(effectiveTargets(["year", "quarter", "day", "week"], (period) => enabled.has(period)), ["year", "day"]);
	assert.deepEqual(effectiveTargets(["quarter"], (period) => enabled.has(period)), []);
});

test("a newly added target goes last, and adding one twice changes nothing", () => {
	assert.deepEqual(addTarget(["month"], "day"), ["month", "day"]);
	assert.deepEqual(addTarget(["month", "day"], "day"), ["month", "day"]);
});

test("removing a target keeps the order of the others", () => {
	assert.deepEqual(removeTarget(["year", "day", "week"], "day"), ["year", "week"]);
	assert.deepEqual(removeTarget(["year", "day"], "quarter"), ["year", "day"]);
});

test("the last target cannot be removed", () => {
	assert.equal(canRemoveTarget(["day"]), false);
	assert.equal(canRemoveTarget(["day", "week"]), true);
	assert.deepEqual(removeTarget(["day"], "day"), ["day"]);
});

test("only the periods not yet targeted are offered, in granularity order", () => {
	assert.deepEqual(targetsToAdd(["year", "day"]), ["week", "month", "quarter"]);
	assert.deepEqual(targetsToAdd([...PERIODS]), []);
});
