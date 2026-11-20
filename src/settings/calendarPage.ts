import type { SettingDefinitionItem, SettingDefinitionList, SettingDefinitionRender, SettingGroupItem } from "obsidian";
import { t, translatedLabels } from "../i18n/index.ts";
import type { TranslationKey } from "../i18n/index.ts";
import { renderLabelWithDots } from "../calendar/cellDots.ts";
import { DOT_SOURCES, MAX_DOTS, MIN_DOTS, canRemoveCell, canRemoveTime, cellsToAdd, duplicateDecorator, filterProblem, linkPlaceValue, linkPlacesToAdd, newDecorator, previewDots, propertyPlace, readsNotes, sourceCanShowWithoutNote, timesToAdd } from "../calendar/decorators.ts";
import type { DotCell, DotColor, DotCount, DotDecorator, DotPosition, DotShape, DotSource, DotTime, FilterProblem, LinkPlace } from "../calendar/decorators.ts";
import { filterRules } from "../filters/filters.ts";
import type { FilterGroup } from "../filters/filters.ts";
import type { LegacyFilterKind } from "../filters/legacy.ts";
import { EXTRA_WEEKS, MONTHS_SHOWN, WEEKS_SHOWN } from "../calendar/settings.ts";
import type { CalendarSettings, CalendarViewKind, TodayRow } from "../calendar/settings.ts";
import type { ReferenceList, ReferenceSources } from "../calendar/references.ts";
import { CALENDAR_CONFIRM_BEFORE_CREATE_KEY, CALENDAR_DIM_WITHOUT_NOTE_KEY, CALENDAR_MONTHS_SHOWN_KEY, CALENDAR_REFERENCES_KEY, CALENDAR_REFERENCE_SOURCES_KEY, CALENDAR_SHOW_WEEK_NUMBERS_KEY, CALENDAR_TODAY_ROW_KEY, CALENDAR_VIEW_KEY, CALENDAR_WEEKS_AFTER_KEY, CALENDAR_WEEKS_BEFORE_KEY, CALENDAR_WEEKS_SHOWN_KEY, decoratorKey } from "./controlKeys.ts";
import { moveEntry } from "./entryList.ts";
import { inapplicableFilter } from "./filterForm.ts";
import { LIST_ROW_EDIT_CLASS, leadWithListControls } from "./listRow.ts";
import type { IdentifiedPage } from "./pages.ts";

export interface Choice<Value extends string> {
	value: Value;
	name: string;
}

export interface CalendarPageContext {
	calendar: () => CalendarSettings;
	decorators: () => DotDecorator[];
	openPage: (pageId: string) => void;
	change: (mutate: () => unknown) => Promise<void>;
	write: (key: string, value: unknown) => void;
	notify: (message: string) => void;
	choose: <Value extends string>(anchor: HTMLElement, choices: Choice<Value>[], pick: (value: Value) => void) => void;
	search: (anchor: HTMLElement, choices: Choice<string>[], typedChoice: (query: string) => Choice<string> | undefined, pick: (value: string) => void) => void;
	propertyNames: () => string[];
	propertyTypes: () => Record<string, string>;
	renderFilter: (settingEl: HTMLElement, filter: FilterGroup) => () => void;
}

export const CALENDAR_PAGE_ID = "calendar";

const DOTS_PREVIEW_CLASSES = ["date-compass-calendar", "date-compass-dots-preview"];
const DOTS_PREVIEW_DAY = "31";

export const SOURCE_LABELS: Record<DotSource, TranslationKey> = {
	words: "dotSourceWords",
	openTasks: "dotSourceOpenTasks",
	links: "dotSourceLinks",
	dateProperty: "dotSourceDateProperty",
};

const VIEW_LABELS: Record<CalendarViewKind, TranslationKey> = {
	month: "calendarViewMonth",
	weeks: "calendarViewWeeks",
};

const TODAY_ROW_LABELS: Record<TodayRow, TranslationKey> = {
	first: "calendarTodayRowFirst",
	middle: "calendarTodayRowMiddle",
	last: "calendarTodayRowLast",
};

const REFERENCE_LIST_LABELS: Record<ReferenceList, TranslationKey> = {
	off: "referencesOff",
	selected: "referencesSelected",
	visible: "referencesVisible",
};

const REFERENCE_SOURCE_LABELS: Record<ReferenceSources, TranslationKey> = {
	dateProperties: "referenceSourcesDateProperties",
	all: "referenceSourcesAll",
};

const COUNT_LABELS: Record<DotCount, TranslationKey> = {
	presence: "dotCountPresence",
	perAmount: "dotCountPerAmount",
};

const SHAPE_LABELS: Record<DotShape, TranslationKey> = {
	filled: "dotShapeFilled",
	hollow: "dotShapeHollow",
};

const COLOR_LABELS: Record<DotColor, TranslationKey> = {
	default: "dotColorDefault",
	accent: "dotColorAccent",
	red: "dotColorRed",
	orange: "dotColorOrange",
	yellow: "dotColorYellow",
	green: "dotColorGreen",
	cyan: "dotColorCyan",
	blue: "dotColorBlue",
	purple: "dotColorPurple",
	pink: "dotColorPink",
};

const POSITION_LABELS: Record<DotPosition, TranslationKey> = {
	below: "dotPositionBelow",
	above: "dotPositionAbove",
	topLeft: "dotPositionTopLeft",
	topRight: "dotPositionTopRight",
};

const CELL_LABELS: Record<DotCell, TranslationKey> = {
	day: "dotCellDays",
	week: "dotCellWeeks",
	month: "dotCellMonths",
	quarter: "dotCellQuarters",
	year: "dotCellYears",
};

const TIME_LABELS: Record<DotTime, TranslationKey> = {
	past: "dotTimePast",
	current: "dotTimeCurrent",
	future: "dotTimeFuture",
};

const AMOUNT_LABELS: Record<DotSource, TranslationKey> = {
	words: "dotAmountWords",
	openTasks: "dotAmountOpenTasks",
	links: "dotAmountLinks",
	dateProperty: "dotAmountDateProperty",
};

const LEGACY_FILTER_LABELS: Record<LegacyFilterKind, TranslationKey> = {
	pathStartsWith: "legacyLinkFilterPathStartsWith",
	nameStartsWith: "legacyLinkFilterNameStartsWith",
	tag: "legacyLinkFilterTag",
	property: "legacyLinkFilterProperty",
};

const FILTER_PROBLEM_WARNINGS: Record<FilterProblem, TranslationKey> = {
	unreadable: "unreadableLinkFilterWarning",
	legacy: "legacyLinkFiltersWarning",
};

export function decoratorPageId(decorator: DotDecorator): string {
	return `dots-${decorator.id}`;
}

export function decoratorName(decorator: DotDecorator): string {
	return decorator.name.trim() === "" ? t(SOURCE_LABELS[decorator.source]) : decorator.name.trim();
}

export function decoratorDescription(decorator: DotDecorator): string {
	switch (decorator.source) {
		case "words":
			return t("dotDescriptionContent");
		case "openTasks":
			return t("dotDescriptionTasks");
		case "links":
			return decorator.linkPlaces.length === 0 ? t("dotDescriptionAnywhere") : decorator.linkPlaces.map(linkPlaceDescription).join(", ");
		case "dateProperty":
			return decorator.dateProperty === "" ? t("dotDescriptionNoDateProperty") : decorator.dateProperty;
	}
}

export function linkPlaceLabel(place: LinkPlace): string {
	switch (place.kind) {
		case "body":
			return t("linkPlaceBody");
		case "anyProperty":
			return t("linkPlaceAnyProperty");
		case "property":
			return t("linkPlaceProperty", { name: place.name });
	}
}

function linkPlaceDescription(place: LinkPlace): string {
	switch (place.kind) {
		case "body":
			return t("dotDescriptionBody");
		case "anyProperty":
			return t("dotDescriptionProperty");
		case "property":
			return place.name;
	}
}

function unknownProperty(name: string, propertyTypes: Record<string, string>): boolean {
	return Object.keys(propertyTypes).length > 0 && !(name.trim().toLowerCase() in propertyTypes);
}

export function decoratorWarning(decorator: DotDecorator, propertyTypes: Record<string, string>): string | undefined {
	const problem = filterProblem(decorator);
	if (problem) return t(FILTER_PROBLEM_WARNINGS[problem]);
	if (decorator.source === "dateProperty" && decorator.dateProperty === "") return t("noDatePropertyWarning");
	if (decorator.source === "dateProperty" && unknownProperty(decorator.dateProperty, propertyTypes)) return t("unknownDatePropertyWarning", { name: decorator.dateProperty.trim() });
	return readsNotes(decorator.source) && inapplicableFilter(decorator.filter, propertyTypes) ? t("inapplicableLinkFilterWarning") : undefined;
}

export function calendarPage(context: CalendarPageContext): IdentifiedPage {
	const decorators = context.decorators();
	return {
		type: "page",
		id: CALENDAR_PAGE_ID,
		name: t("calendarSection"),
		desc: t("calendarSectionDesc"),
		items: calendarItems(decorators, context),
	};
}

export function calendarItems(decorators: DotDecorator[], context: CalendarPageContext): SettingDefinitionItem[] {
	return [
		{ type: "group", items: viewItems(context.calendar().view) },
		{
			type: "group",
			items: [
				{ name: t("calendarShowWeekNumbers"), desc: t("calendarShowWeekNumbersDesc"), control: { type: "toggle", key: CALENDAR_SHOW_WEEK_NUMBERS_KEY } },
				{ name: t("calendarDimWithoutNote"), desc: t("calendarDimWithoutNoteDesc"), control: { type: "toggle", key: CALENDAR_DIM_WITHOUT_NOTE_KEY } },
				{ name: t("calendarConfirmBeforeCreate"), desc: t("calendarConfirmBeforeCreateDesc"), control: { type: "toggle", key: CALENDAR_CONFIRM_BEFORE_CREATE_KEY } },
			],
		},
		decoratorsList(decorators, context),
		{
			type: "group",
			heading: t("referencesHeading"),
			items: [
				{ name: t("references"), desc: t("referencesDesc"), control: { type: "dropdown", key: CALENDAR_REFERENCES_KEY, options: translatedLabels(REFERENCE_LIST_LABELS) } },
				{ name: t("referenceSources"), desc: t("referenceSourcesDesc"), control: { type: "dropdown", key: CALENDAR_REFERENCE_SOURCES_KEY, options: translatedLabels(REFERENCE_SOURCE_LABELS) } },
			],
		},
		{ type: "group", visible: false, items: decorators.map((decorator) => decoratorPage(decorator, context)) },
	];
}

function viewItems(view: CalendarViewKind): SettingGroupItem[] {
	const viewChoice: SettingGroupItem = { name: t("calendarView"), desc: t("calendarViewDesc"), control: { type: "dropdown", key: CALENDAR_VIEW_KEY, options: translatedLabels(VIEW_LABELS) } };
	if (view === "weeks") {
		return [
			viewChoice,
			{ name: t("calendarWeeksShown"), desc: t("calendarWeeksShownDesc"), control: { type: "number", key: CALENDAR_WEEKS_SHOWN_KEY, min: WEEKS_SHOWN.min, max: WEEKS_SHOWN.max, step: 1 } },
			{ name: t("calendarTodayRow"), desc: t("calendarTodayRowDesc"), control: { type: "dropdown", key: CALENDAR_TODAY_ROW_KEY, options: translatedLabels(TODAY_ROW_LABELS) } },
		];
	}
	return [
		viewChoice,
		{ name: t("calendarMonthsShown"), desc: t("calendarMonthsShownDesc"), control: { type: "number", key: CALENDAR_MONTHS_SHOWN_KEY, min: MONTHS_SHOWN.min, max: MONTHS_SHOWN.max, step: 1 } },
		{ name: t("calendarWeeksBefore"), desc: t("calendarWeeksBeforeDesc"), control: { type: "number", key: CALENDAR_WEEKS_BEFORE_KEY, min: EXTRA_WEEKS.min, max: EXTRA_WEEKS.max, step: 1 } },
		{ name: t("calendarWeeksAfter"), desc: t("calendarWeeksAfterDesc"), control: { type: "number", key: CALENDAR_WEEKS_AFTER_KEY, min: EXTRA_WEEKS.min, max: EXTRA_WEEKS.max, step: 1 } },
	];
}

function decoratorsList(decorators: DotDecorator[], context: CalendarPageContext): SettingDefinitionList {
	return {
		type: "list",
		heading: t("dotsList"),
		emptyState: t("noDotsYet"),
		items: decorators.map((decorator, index) => decoratorRow(decorators, index, context)),
		onReorder: (from, to) => void context.change(() => moveEntry(decorators, from, to)),
		onDelete: (index) => void context.change(() => decorators.splice(index, 1)),
		addItem: {
			name: t("addDots"),
			action: (anchor: HTMLElement) =>
				context.choose(
					anchor,
					DOT_SOURCES.map((source) => ({ value: source, name: t(SOURCE_LABELS[source]) })),
					(source) => {
						const decorator = newDecorator(decorators, source);
						void context.change(() => decorators.push(decorator)).then(() => context.openPage(decoratorPageId(decorator)));
					},
				),
		},
	};
}

function decoratorRow(decorators: DotDecorator[], index: number, context: CalendarPageContext): SettingDefinitionRender {
	const decorator = decorators[index];
	const description = () => decoratorWarning(decorator, context.propertyTypes()) ?? decoratorDescription(decorator);
	return {
		name: decoratorName(decorator),
		desc: description(),
		render: (setting) => {
			setting.setName(decoratorName(decorator));
			renderLabelWithDots(setting.nameEl.createSpan({ cls: DOTS_PREVIEW_CLASSES }).createDiv({ cls: "day" }), DOTS_PREVIEW_DAY, previewDots(decorator), decorator.position === "above");
			setting.setDesc(description());
			setting.addExtraButton((button) =>
				button
					.setIcon("pencil")
					.setTooltip(t("editDots"))
					.onClick(() => context.openPage(decoratorPageId(decorator)))
					.extraSettingsEl.addClass(LIST_ROW_EDIT_CLASS),
			);
			setting.addExtraButton((button) =>
				button
					.setIcon("copy")
					.setTooltip(t("duplicateDots"))
					.onClick(() => {
						const copy = duplicateDecorator(decorators, decorator, t("dotsCopyName", { name: decoratorName(decorator) }));
						void context.change(() => decorators.splice(index + 1, 0, copy)).then(() => context.openPage(decoratorPageId(copy)));
					}),
			);
			return leadWithListControls(setting);
		},
	};
}

function decoratorPage(decorator: DotDecorator, context: CalendarPageContext): IdentifiedPage {
	const key = (field: Parameters<typeof decoratorKey>[1]) => decoratorKey(decorator.id, field);
	const countsAmount = decorator.count === "perAmount";
	const sourceItems: SettingGroupItem[] = [
		{ name: t("dotsName"), desc: t("dotsNameDesc"), control: { type: "text", key: key("name"), placeholder: t(SOURCE_LABELS[decorator.source]) } },
		{ name: t("dotsSource"), desc: t("dotsSourceDesc"), control: { type: "dropdown", key: key("source"), options: translatedLabels(SOURCE_LABELS) } },
		...(decorator.source === "dateProperty"
			? [{ name: t("dotsDateProperty"), desc: t("dotsDatePropertyDesc"), control: { type: "text" as const, key: key("dateProperty"), placeholder: "deadline" } }]
			: []),
		{ name: t("dotsCount"), desc: t("dotsCountDesc"), control: { type: "dropdown", key: key("count"), options: translatedLabels(COUNT_LABELS) } },
		...(countsAmount
			? [
					{ name: t(AMOUNT_LABELS[decorator.source]), desc: t("dotsAmountPerDotDesc"), control: { type: "number" as const, key: key("amountPerDot"), min: 1, step: 1 } },
					{ name: t("dotsMaxDots"), desc: t("dotsMaxDotsDesc", { max: MAX_DOTS }), control: { type: "number" as const, key: key("maxDots"), min: MIN_DOTS, max: MAX_DOTS, step: 1 } },
				]
			: []),
		...(sourceCanShowWithoutNote(decorator.source)
			? [{ name: t("dotsShowWithoutNote"), desc: t("dotsShowWithoutNoteDesc"), control: { type: "toggle" as const, key: key("showWithoutNote") } }]
			: []),
	];
	return {
		type: "page",
		id: decoratorPageId(decorator),
		get name() {
			return decoratorName(decorator);
		},
		status: () => (decoratorWarning(decorator, context.propertyTypes()) ? "warning" : null),
		items: [
			{ type: "group", items: sourceItems },
			cellsList(decorator, context),
			timesList(decorator, context),
			{
				type: "group",
				heading: t("dotsLook"),
				items: [
					{ name: t("dotsShape"), desc: t("dotsShapeDesc"), control: { type: "dropdown", key: key("shape"), options: translatedLabels(SHAPE_LABELS) } },
					{ name: t("dotsColor"), desc: t("dotsColorDesc"), control: { type: "dropdown", key: key("color"), options: translatedLabels(COLOR_LABELS) } },
					{ name: t("dotsPosition"), desc: t("dotsPositionDesc"), control: { type: "dropdown", key: key("position"), options: translatedLabels(POSITION_LABELS) } },
				],
			},
			...(decorator.source === "links" ? [linkPlacesList(decorator, context)] : []),
			...(readsNotes(decorator.source) ? filterItems(decorator, context) : []),
		],
	};
}

function cellsList(decorator: DotDecorator, context: CalendarPageContext): SettingDefinitionList {
	const { cells } = decorator;
	const write = (next: DotCell[]) => context.write(decoratorKey(decorator.id, "cells"), next);
	return {
		type: "list",
		heading: t("dotCells"),
		items: cells.map((cell) => ({ name: t(CELL_LABELS[cell]) })),
		onDelete: (position) => {
			if (!canRemoveCell(cells)) context.notify(t("keepOneDotCell"));
			else write(cells.filter((_, index) => index !== position));
		},
		addItem: {
			name: t("addDotCell"),
			action: (anchor: HTMLElement) => {
				const remaining = cellsToAdd(cells);
				if (remaining.length === 0) context.notify(t("everyDotCellListed"));
				else context.choose(anchor, remaining.map((cell) => ({ value: cell, name: t(CELL_LABELS[cell]) })), (cell) => write([...cells, cell]));
			},
		},
	};
}

function timesList(decorator: DotDecorator, context: CalendarPageContext): SettingDefinitionList {
	const { times } = decorator;
	const write = (next: DotTime[]) => context.write(decoratorKey(decorator.id, "times"), next);
	return {
		type: "list",
		heading: t("dotTimes"),
		items: times.map((time) => ({ name: t(TIME_LABELS[time]) })),
		onDelete: (position) => {
			if (!canRemoveTime(times)) context.notify(t("keepOneDotTime"));
			else write(times.filter((_, index) => index !== position));
		},
		addItem: {
			name: t("addDotTime"),
			action: (anchor: HTMLElement) => {
				const remaining = timesToAdd(times);
				if (remaining.length === 0) context.notify(t("everyDotTimeListed"));
				else context.choose(anchor, remaining.map((time) => ({ value: time, name: t(TIME_LABELS[time]) })), (time) => write([...times, time]));
			},
		},
	};
}

function linkPlacesList(decorator: DotDecorator, context: CalendarPageContext): SettingDefinitionList {
	const { linkPlaces } = decorator;
	const write = (next: LinkPlace[]) => context.write(decoratorKey(decorator.id, "linkPlaces"), next);
	return {
		type: "list",
		heading: t("linkPlaces"),
		emptyState: t("linkPlacesAnywhere"),
		items: linkPlaces.map((place) => ({ name: linkPlaceLabel(place) })),
		onDelete: (position) => write(linkPlaces.filter((_, index) => index !== position)),
		addItem: {
			name: t("addLinkPlace"),
			action: (anchor: HTMLElement) => {
				const offered = new Map(linkPlacesToAdd(linkPlaces, context.propertyNames()).map((place) => [linkPlaceValue(place), place]));
				const listed = new Set(linkPlaces.map(linkPlaceValue));
				const typed = new Map<string, LinkPlace>();
				const typedChoice = (query: string): Choice<string> | undefined => {
					const place = propertyPlace(query);
					if (!place) return undefined;
					const value = linkPlaceValue(place);
					if (offered.has(value) || listed.has(value)) return undefined;
					typed.set(value, place);
					return { value, name: linkPlaceLabel(place) };
				};
				const choices = [...offered].map(([value, place]) => ({ value, name: linkPlaceLabel(place) }));
				context.search(anchor, choices, typedChoice, (value) => {
					const place = offered.get(value) ?? typed.get(value);
					if (place) write([...linkPlaces, place]);
				});
			},
		},
	};
}

function filterDescription(decorator: DotDecorator): string {
	const empty = filterRules(decorator.filter).length === 0;
	if (decorator.source === "dateProperty") return empty ? t("datedFilterEmptyDesc") : t("datedFilterDesc");
	return empty ? t("linkFilterEmptyDesc") : t("linkFilterDesc");
}

function filterItems(decorator: DotDecorator, context: CalendarPageContext): SettingDefinitionItem[] {
	const { legacyFilters } = decorator;
	const filter: SettingDefinitionRender =
		decorator.unreadableFilter === undefined
			? {
					name: t("linkFilter"),
					desc: filterDescription(decorator),
					searchable: false,
					render: (setting) => context.renderFilter(setting.settingEl, decorator.filter),
				}
			: {
					name: t("unreadableLinkFilter"),
					desc: t("unreadableLinkFilterWarning"),
					searchable: false,
					render: (setting) => {
						setting.addButton((button) =>
							button
								.setButtonText(t("removeUnreadableLinkFilter"))
								.setDestructive()
								.onClick(() => void context.change(() => delete decorator.unreadableFilter)),
						);
					},
				};
	if (legacyFilters.length === 0) return [{ type: "group", heading: t("linkFilters"), items: [filter] }];
	const legacy: SettingDefinitionList = {
		type: "list",
		items: legacyFilters.map(({ kind, value }) => ({ name: t(LEGACY_FILTER_LABELS[kind], { value: value.trim() }) })),
		onDelete: (index) => void context.change(() => legacyFilters.splice(index, 1)),
	};
	return [
		{ type: "group", heading: t("linkFilters"), items: [filter] },
		{ type: "group", heading: t("legacyLinkFilters"), items: [{ name: t("legacyLinkFiltersNotice"), desc: t("legacyLinkFiltersWarning"), searchable: false }] },
		legacy,
	];
}
