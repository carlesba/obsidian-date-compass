import { t } from "../i18n/index.ts";
import { questionOf } from "./settings.ts";
import type { DateCommand, WriteMode } from "./settings.ts";

export function pickerTextOf(command: DateCommand, mode: WriteMode = command.mode): { placeholder: string; note: string } {
	return {
		placeholder: questionOf(command),
		note: t(mode === "add" ? "dateToProperty" : "dateReplacesProperty", { name: command.property.trim() }),
	};
}

export function pickerNoteTextOf(options: { placeholder: string; note?: string }): string | undefined {
	return options.note ? options.note : undefined;
}

export function phrasePickerTextOf(): { placeholder: string } {
	return { placeholder: t("phrasePlaceholder") };
}
