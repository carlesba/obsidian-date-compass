import { t } from "../i18n/index.ts";
import { commandName, questionOf } from "./settings.ts";
import type { DateCommand, WriteMode } from "./settings.ts";
import { effectiveMode } from "./value.ts";
import type { PropertyKind } from "./value.ts";
import type { WriteTarget } from "./write.ts";

export interface PickerText {
	placeholder: string;
	note?: string;
}

export function pickerTextOf(command: DateCommand, mode: WriteMode = command.mode): { placeholder: string; note: string } {
	return {
		placeholder: questionOf(command),
		note: t(mode === "add" ? "dateToProperty" : "dateReplacesProperty", { name: command.property.trim() }),
	};
}

export function pickerTextFor(command: DateCommand, target: WriteTarget, kind: PropertyKind): PickerText {
	if (target.kind === "property") return pickerTextOf(command, effectiveMode(target.mode, kind));
	if (target.kind === "body") return phrasePickerTextOf();
	return { ...phrasePickerTextOf(), note: t("dateToProperty", { name: target.property }) };
}

export interface DatesQuestionText {
	title: string;
	propertyName?: string;
	replacesProperty?: boolean;
}

export function datesQuestionFor(command: DateCommand, target: WriteTarget, kind: PropertyKind): DatesQuestionText {
	if (target.kind === "property") return { title: questionOf(command), propertyName: target.property, replacesProperty: effectiveMode(target.mode, kind) === "replace" };
	if (target.kind === "body") return { title: commandName(command) };
	return { title: commandName(command), propertyName: target.property };
}

export function pickerNoteTextOf(options: PickerText): string | undefined {
	return options.note ? options.note : undefined;
}

export function phrasePickerTextOf(): { placeholder: string } {
	return { placeholder: t("phrasePlaceholder") };
}
