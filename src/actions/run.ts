import type { MomentFactory } from "../dateNotes/paths.ts";
import type { PeriodSettingsByPeriod } from "../dateNotes/periods.ts";
import type { NoteRef } from "../mentions/rows.ts";
import { formattedItems } from "../insertion/render.ts";
import type { InsertionSettings } from "../insertion/settings.ts";
import { insertAtCursor } from "../sequence/preview.ts";
import type { CursorEditor } from "../sequence/preview.ts";
import { applyPropertyWrites, dateSortKey } from "./frontmatter.ts";
import type { PropertyWrite } from "./frontmatter.ts";
import { ALWAYS, writeWarning } from "./settings.ts";
import type { ActionInput, ActionWrite, DateAction } from "./settings.ts";

export type Answer = { kind: "notes"; notes: NoteRef[] } | { kind: "yesNo"; yes: boolean } | { kind: "skipped" };

export interface ActionHost {
	ask(input: ActionInput): Promise<Answer | undefined>;
	linkTo: (note: NoteRef) => string;
	propertyLinkTo: (note: NoteRef) => string;
	processFrontMatter(change: (frontmatter: Record<string, unknown>) => void): Promise<void>;
	notify(message: string): void;
}

export interface ActionContext {
	periods: PeriodSettingsByPeriod;
	moment: MomentFactory;
	insertion: InsertionSettings;
	editor?: CursorEditor;
}

export interface PlannedWrites {
	properties: PropertyWrite[];
	body: { notes: NoteRef[]; format: ActionWrite["format"] }[];
}

export type RunOutcome = "written" | "cancelled" | "nothingToWrite" | "noEditor" | "noCompleteWrite";

export async function runAction(action: DateAction, host: ActionHost, context: ActionContext): Promise<RunOutcome> {
	if (action.writes.every((write) => writeWarning(action, write))) return "noCompleteWrite";
	const answers = new Map<string, Answer>();
	for (const input of action.inputs) {
		const answer = await host.ask(input);
		if (!answer) return "cancelled";
		answers.set(input.id, answer);
	}
	const planned = plannedWrites(action, answers, host.propertyLinkTo);
	if (planned.properties.length === 0 && planned.body.length === 0) return "nothingToWrite";
	if (planned.body.length > 0 && !context.editor) return "noEditor";
	if (planned.properties.length > 0) {
		const sortKeyOf = dateSortKey(context.periods, context.moment);
		await host.processFrontMatter((frontmatter) => applyPropertyWrites(frontmatter, planned.properties, sortKeyOf));
	}
	for (const { notes, format } of planned.body) {
		if (!context.editor) break;
		const items = formattedItems(notes.map(formatter(format, host.linkTo)), notes, context.insertion.linkTemplate);
		insertAtCursor(context.editor, items, context.insertion.separator);
	}
	return "written";
}

export function plannedWrites(action: DateAction, answers: ReadonlyMap<string, Answer>, propertyLinkTo: (note: NoteRef) => string): PlannedWrites {
	const planned: PlannedWrites = { properties: [], body: [] };
	for (const write of action.writes) {
		if (writeWarning(action, write) || !conditionHolds(write, answers)) continue;
		const answer = answers.get(write.input);
		if (answer?.kind !== "notes" || answer.notes.length === 0) continue;
		const notes = chosenNotes(answer.notes, write.value);
		if (write.target === "body") planned.body.push({ notes, format: write.format });
		else planned.properties.push({ property: write.property.trim(), values: notes.map(formatter(write.format, propertyLinkTo)), mode: write.mode });
	}
	return planned;
}

function conditionHolds(write: ActionWrite, answers: ReadonlyMap<string, Answer>): boolean {
	if (write.condition === ALWAYS) return true;
	const answer = answers.get(write.condition);
	return answer?.kind === "yesNo" && answer.yes;
}

function chosenNotes(notes: NoteRef[], value: ActionWrite["value"]): NoteRef[] {
	if (value === "first") return notes.slice(0, 1);
	if (value === "last") return notes.slice(-1);
	return notes;
}

function formatter(format: ActionWrite["format"], linkTo: (note: NoteRef) => string): (note: NoteRef) => string {
	return format === "link" ? linkTo : (note) => note.name;
}
