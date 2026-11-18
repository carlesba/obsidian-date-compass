import { test } from "node:test";
import { strict as assert } from "node:assert";
import { singleFlight } from "../src/calendar/singleFlight.ts";

function pendingTask() {
	let finish = () => {};
	let fail = (_error: Error) => {};
	let starts = 0;
	const settled = new Promise<void>((resolve, reject) => {
		finish = resolve;
		fail = reject;
	});
	return {
		task: () => {
			starts += 1;
			return settled;
		},
		finish: () => finish(),
		fail: (error: Error) => fail(error),
		starts: () => starts,
	};
}

test("a second activation of the same key is ignored while the first is in flight", async () => {
	const run = singleFlight();
	const first = pendingTask();
	const second = pendingTask();
	const running = run("2026-11-17.md", first.task);
	await run("2026-11-17.md", second.task);
	assert.equal(first.starts(), 1);
	assert.equal(second.starts(), 0);
	first.finish();
	await running;
});

test("another key runs while the first is in flight", async () => {
	const run = singleFlight();
	const first = pendingTask();
	const other = pendingTask();
	const running = run("2026-11-17.md", first.task);
	const runningOther = run("2026-11-18.md", other.task);
	assert.equal(other.starts(), 1);
	first.finish();
	other.finish();
	await Promise.all([running, runningOther]);
});

test("the key can be activated again once its task has settled, also after a failure", async () => {
	const run = singleFlight();
	const first = pendingTask();
	const running = run("2026-11-17.md", first.task);
	first.finish();
	await running;
	const failing = pendingTask();
	const runningFailing = run("2026-11-17.md", failing.task);
	assert.equal(failing.starts(), 1);
	failing.fail(new Error("could not create"));
	await assert.rejects(runningFailing, /could not create/);
	const third = pendingTask();
	const runningThird = run("2026-11-17.md", third.task);
	assert.equal(third.starts(), 1);
	third.finish();
	await runningThird;
});
