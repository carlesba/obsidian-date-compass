import { t } from "../i18n/index.ts";
import { questionOf } from "./settings.ts";
import type { DateAction } from "./settings.ts";

export function pickerTextOf(action: DateAction): { placeholder: string; note: string } {
	return {
		placeholder: questionOf(action),
		note: t("dateReplacesProperty", { name: action.property.trim() }),
	};
}

export function pickerNoteTextOf(options: { placeholder: string; note?: string }): string | undefined {
	return options.note ? options.note : undefined;
}

export function phrasePickerTextOf(): { placeholder: string } {
	return { placeholder: t("phrasePlaceholder") };
}
