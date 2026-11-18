import type { SettingDefinitionGroup } from "obsidian";
import { t } from "../i18n/index.ts";
import { DEFAULT_WORDS_PER_DOT } from "../calendar/settings.ts";
import { CALENDAR_CONFIRM_BEFORE_CREATE_KEY, CALENDAR_SHOW_WEEK_NUMBERS_KEY, CALENDAR_THEME_COMPATIBILITY_KEY, CALENDAR_WORDS_PER_DOT_KEY } from "./controlKeys.ts";

export function calendarGroups(sharesRootIdWithOriginalCalendar: () => boolean): SettingDefinitionGroup[] {
	return [
		{
			type: "group",
			items: [
				{
					name: t("calendarShowWeekNumbers"),
					desc: t("calendarShowWeekNumbersDesc"),
					control: { type: "toggle", key: CALENDAR_SHOW_WEEK_NUMBERS_KEY },
				},
				{
					name: t("calendarConfirmBeforeCreate"),
					desc: t("calendarConfirmBeforeCreateDesc"),
					control: { type: "toggle", key: CALENDAR_CONFIRM_BEFORE_CREATE_KEY },
				},
				{
					name: t("calendarWordsPerDot"),
					desc: t("calendarWordsPerDotDesc"),
					control: { type: "number", key: CALENDAR_WORDS_PER_DOT_KEY, min: 0, step: 1, placeholder: String(DEFAULT_WORDS_PER_DOT) },
				},
				{
					name: t("calendarThemeCompatibility"),
					desc: t("calendarThemeCompatibilityDesc"),
					control: { type: "toggle", key: CALENDAR_THEME_COMPATIBILITY_KEY },
				},
			],
		},
		{
			type: "group",
			visible: sharesRootIdWithOriginalCalendar,
			items: [{ name: t("calendarThemeCompatibilityClash"), desc: t("calendarThemeCompatibilityClashDesc") }],
		},
	];
}
