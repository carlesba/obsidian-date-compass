export const en = {
	languageEnglish: "English",
	languageSpanish: "Spanish",

	parserLanguages: "Languages",
	parserLanguagesDesc: "Date phrases are understood in every language turned on here.",
	weekStart: "Week starts on",
	weekStartDesc: "The first day of a week, for week notes and phrases such as \"this wed\".",
	weekStartLocale: "Locale default",
	weekStartMonday: "Monday",
	weekStartSunday: "Sunday",
	nextWeekday: "\"Next\" weekday means",
	nextWeekdayDesc: "What a phrase such as \"next wed\" points to.",
	nextWeekdayNextWeek: "That day of next week",
	nextWeekdayNextOccurrence: "The next time that day comes",
	dayMonthOrder: "Numeric dates",
	dayMonthOrderDesc: "How a date such as 3/12 is read.",
	dayMonthOrderDayMonth: "Day, then month",
	dayMonthOrderMonthDay: "Month, then day",

	dateNotesSection: "Date notes",
	dateNotesSectionDesc: "Folders, name formats and templates of daily, weekly, monthly, quarterly and yearly notes.",
	mentionsSection: "Mentions",
	mentionsSectionDesc: "Link a date note while typing, after a trigger such as @.",
	insertSequenceSection: "Insert sequence",
	insertSequenceSectionDesc: "Insert the links of a range or sequence of dates at the cursor.",
	actionsSection: "Actions",
	actionsSectionDesc: "Commands that ask for dates and write them into properties or the note.",

	resetAllSettings: "Reset all settings",
	resetAllSettingsDesc: "Put every option back to the defaults.",
	resetTitle: "Reset all Date Compass settings?",
	resetMessage: "Every option goes back to the defaults. This can't be undone.",
	cancel: "Cancel",
	reset: "Reset",
} as const;

export type TranslationKey = keyof typeof en;

export type Translation = Partial<Record<TranslationKey, string>>;
