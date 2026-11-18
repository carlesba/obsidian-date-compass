import type { Moment } from "moment";
import type { SettingDefinitionGroup, SettingDefinitionList } from "obsidian";
import { t, translatedLabels } from "../i18n/index.ts";
import type { TranslationKey } from "../i18n/index.ts";
import { DAY_MONTH_ORDERS } from "../settings.ts";
import type { DayMonthOrder, NextWeekdayMeaning, ParserLanguage, WeekStart } from "../settings.ts";
import { DAY_MONTH_ORDER_KEY, NEXT_WEEKDAY_KEY, WEEK_START_KEY } from "./controlKeys.ts";
import { addLanguage, canRemoveLanguage, languagesToAdd, removeLanguage } from "./languageList.ts";
import type { IdentifiedPage } from "./pages.ts";
import { addTodaySample, todayIn } from "./todaySample.ts";
import type { SampleHost } from "./todaySample.ts";

export const LOCALIZATION_PAGE_ID = "localization";

const LANGUAGE_NAMES: Record<ParserLanguage, TranslationKey> = {
	en: "languageEnglish",
	es: "languageSpanish",
};

const WEEK_START_LABELS: Record<WeekStart, TranslationKey> = {
	locale: "weekStartLocale",
	monday: "weekStartMonday",
	sunday: "weekStartSunday",
};

const NEXT_WEEKDAY_LABELS: Record<NextWeekdayMeaning, TranslationKey> = {
	nextWeek: "nextWeekdayNextWeek",
	nextOccurrence: "nextWeekdayNextOccurrence",
};

const DAY_MONTH_ORDER_LABELS: Record<DayMonthOrder, TranslationKey> = {
	dayMonth: "dayMonthOrderDayMonth",
	monthDay: "dayMonthOrderMonthDay",
};

const DAY_MONTH_ORDER_FORMATS: Record<DayMonthOrder, string> = {
	dayMonth: "D/M",
	monthDay: "M/D",
};

export interface LanguageChoice {
	language: ParserLanguage;
	name: string;
}

export interface LocalizationPageContext extends SampleHost {
	languages: () => readonly ParserLanguage[];
	dayMonthOrder: () => DayMonthOrder;
	changeLanguages: (languages: ParserLanguage[]) => void;
	chooseLanguage: (anchor: HTMLElement, choices: LanguageChoice[], pick: (language: ParserLanguage) => void) => void;
	notify: (message: string) => void;
}

export function dayMonthOrderSample(order: DayMonthOrder, today: Moment): string {
	return todayIn(DAY_MONTH_ORDER_FORMATS[order], today);
}

export function localizationPage(context: LocalizationPageContext): IdentifiedPage {
	return {
		type: "page",
		id: LOCALIZATION_PAGE_ID,
		name: t("localizationSection"),
		desc: t("localizationSectionDesc"),
		items: [readingGroup(context), languagesList(context)],
	};
}

function languagesList(context: LocalizationPageContext): SettingDefinitionList {
	const enabled = context.languages();
	const remaining = languagesToAdd(enabled);
	const add = (language: ParserLanguage) => context.changeLanguages(addLanguage(enabled, language));
	return {
		type: "list",
		heading: t("parserLanguages"),
		items: enabled.map((language, position) => ({
			name: t(LANGUAGE_NAMES[language]),
			desc: position === 0 && enabled.length > 1 ? t("firstLanguageDesc") : undefined,
		})),
		onDelete: (position: number) => {
			if (!canRemoveLanguage(enabled)) context.notify(t("keepOneLanguage"));
			else context.changeLanguages(removeLanguage(enabled, enabled[position]));
		},
		addItem: {
			name: t("addLanguage"),
			action: (anchor: HTMLElement) => {
				if (remaining.length === 0) context.notify(t("everyLanguageListed"));
				else if (remaining.length === 1) add(remaining[0]);
				else context.chooseLanguage(anchor, remaining.map((language) => ({ language, name: t(LANGUAGE_NAMES[language]) })), add);
			},
		},
	};
}

function readingGroup(context: LocalizationPageContext): SettingDefinitionGroup {
	return {
		type: "group",
		items: [
			{
				name: t("weekStart"),
				desc: t("weekStartDesc"),
				control: { type: "dropdown", key: WEEK_START_KEY, options: translatedLabels(WEEK_START_LABELS) },
			},
			{
				name: t("nextWeekday"),
				desc: t("nextWeekdayDesc"),
				control: { type: "dropdown", key: NEXT_WEEKDAY_KEY, options: translatedLabels(NEXT_WEEKDAY_LABELS) },
			},
			{
				name: t("dayMonthOrder"),
				desc: t("dayMonthOrderDesc"),
				render: (setting) => {
					const showSample = addTodaySample(setting, dayMonthOrderSample(context.dayMonthOrder(), context.today()));
					setting.addDropdown((dropdown) =>
						dropdown
							.addOptions(translatedLabels(DAY_MONTH_ORDER_LABELS))
							.setValue(context.dayMonthOrder())
							.onChange((picked) => {
								const order = DAY_MONTH_ORDERS.find((known) => known === picked);
								if (!order) return;
								context.write(DAY_MONTH_ORDER_KEY, order);
								showSample(dayMonthOrderSample(order, context.today()));
							}),
					);
				},
			},
		],
	};
}
