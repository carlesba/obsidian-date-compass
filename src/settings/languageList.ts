import { PARSER_LANGUAGES } from "../settings.ts";
import type { ParserLanguage } from "../settings.ts";

export function languagesToAdd(enabled: readonly ParserLanguage[]): ParserLanguage[] {
	return PARSER_LANGUAGES.filter((language) => !enabled.includes(language));
}

export function canRemoveLanguage(enabled: readonly ParserLanguage[]): boolean {
	return enabled.length > 1;
}

export function addLanguage(enabled: readonly ParserLanguage[], language: ParserLanguage): ParserLanguage[] {
	return enabled.includes(language) ? [...enabled] : [...enabled, language];
}

export function removeLanguage(enabled: readonly ParserLanguage[], language: ParserLanguage): ParserLanguage[] {
	return canRemoveLanguage(enabled) ? enabled.filter((kept) => kept !== language) : [...enabled];
}
