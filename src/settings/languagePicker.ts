import { setIcon } from "obsidian";
import type { Setting } from "obsidian";
import { t } from "../i18n/index.ts";
import type { TranslationKey } from "../i18n/index.ts";
import { isParserLanguage } from "../settings.ts";
import type { ParserLanguage } from "../settings.ts";
import { addLanguage, canRemoveLanguage, languagesToAdd, removeLanguage } from "./languageList.ts";

const LANGUAGE_NAMES: Record<ParserLanguage, TranslationKey> = {
	en: "languageEnglish",
	es: "languageSpanish",
};

export interface LanguagePickerHost {
	languages: () => readonly ParserLanguage[];
	change: (languages: ParserLanguage[]) => void;
}

export function renderLanguagePicker(setting: Setting, host: LanguagePickerHost): void {
	const enabled = host.languages();
	const chips = setting.controlEl.createDiv({ cls: "date-compass-language-chips" });
	for (const language of enabled) {
		const chip = chips.createDiv({ cls: "multi-select-pill date-compass-language-chip" });
		chip.createDiv({ cls: "multi-select-pill-content", text: t(LANGUAGE_NAMES[language]) });
		if (!canRemoveLanguage(enabled)) continue;
		const remove = chip.createEl("button", {
			cls: "multi-select-pill-remove-button clickable-icon",
			attr: { "aria-label": t("removeLanguage", { language: t(LANGUAGE_NAMES[language]) }) },
		});
		setIcon(remove, "x");
		remove.addEventListener("click", () => host.change(removeLanguage(enabled, language)));
	}
	const remaining = languagesToAdd(enabled);
	if (remaining.length === 0) return;
	setting.addDropdown((dropdown) => {
		dropdown.addOption("", t("addLanguage"));
		for (const language of remaining) dropdown.addOption(language, t(LANGUAGE_NAMES[language]));
		dropdown.setValue("");
		dropdown.onChange((value) => {
			if (isParserLanguage(value)) host.change(addLanguage(enabled, value));
		});
	});
}
