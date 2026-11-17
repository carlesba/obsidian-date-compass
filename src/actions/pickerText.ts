import { t } from "../i18n/index.ts";
import { questionOf } from "./settings.ts";
import type { DateAction } from "./settings.ts";

export function pickerTextOf(action: DateAction): { placeholder: string; note: string } {
	return {
		placeholder: questionOf(action),
		note: t("dateReplacesProperty", { name: action.property.trim() }),
	};
}
