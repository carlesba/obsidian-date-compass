import type { SettingDefinitionItem, SettingDefinitionList, SettingDefinitionRender, SettingGroupItem } from "obsidian";
import { t, translatedLabels } from "../i18n/index.ts";
import type { TranslationKey } from "../i18n/index.ts";
import { DOT_SOURCES, LINK_FILTER_KINDS, MAX_DOTS, MIN_DOTS, canRemoveCell, cellsToAdd, newDecorator, sourceCanShowWithoutNote } from "../calendar/decorators.ts";
import type { DotCell, DotColor, DotCount, DotDecorator, DotPosition, DotShape, DotSource, LinkFilterKind } from "../calendar/decorators.ts";
import { CALENDAR_CONFIRM_BEFORE_CREATE_KEY, CALENDAR_SHOW_WEEK_NUMBERS_KEY, CALENDAR_THEME_COMPATIBILITY_KEY, decoratorKey } from "./controlKeys.ts";
import { moveEntry } from "./entryList.ts";
import { LIST_ROW_EDIT_CLASS, leadWithListControls } from "./listRow.ts";
import type { IdentifiedPage } from "./pages.ts";

export interface Choice<Value extends string> {
	value: Value;
	name: string;
}

export interface CalendarPageContext {
	decorators: () => DotDecorator[];
	sharesRootIdWithOriginalCalendar: () => boolean;
	openPage: (pageId: string) => void;
	change: (mutate: () => unknown) => Promise<void>;
	write: (key: string, value: unknown) => void;
	notify: (message: string) => void;
	choose: <Value extends string>(anchor: HTMLElement, choices: Choice<Value>[], pick: (value: Value) => void) => void;
}

export const CALENDAR_PAGE_ID = "calendar";

export const SOURCE_LABELS: Record<DotSource, TranslationKey> = {
	words: "dotSourceWords",
	openTasks: "dotSourceOpenTasks",
	links: "dotSourceLinks",
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
};

const AMOUNT_LABELS: Record<DotSource, TranslationKey> = {
	words: "dotAmountWords",
	openTasks: "dotAmountOpenTasks",
	links: "dotAmountLinks",
};

const UNIT_LABELS: Record<DotSource, TranslationKey> = {
	words: "dotUnitWords",
	openTasks: "dotUnitOpenTasks",
	links: "dotUnitLinks",
};

const FILTER_LABELS: Record<LinkFilterKind, TranslationKey> = {
	pathStartsWith: "linkFilterPathStartsWith",
	nameStartsWith: "linkFilterNameStartsWith",
	tag: "linkFilterTag",
	property: "linkFilterProperty",
};

const FILTER_DESCRIPTIONS: Record<LinkFilterKind, TranslationKey> = {
	pathStartsWith: "linkFilterPathStartsWithDesc",
	nameStartsWith: "linkFilterNameStartsWithDesc",
	tag: "linkFilterTagDesc",
	property: "linkFilterPropertyDesc",
};

const FILTER_PLACEHOLDERS: Record<LinkFilterKind, string> = {
	pathStartsWith: "Meetings/",
	nameStartsWith: "Meeting",
	tag: "#meeting",
	property: "type: meeting",
};

export function decoratorPageId(decorator: DotDecorator): string {
	return `dots-${decorator.id}`;
}

export function decoratorName(decorator: DotDecorator): string {
	return decorator.name.trim() === "" ? t(SOURCE_LABELS[decorator.source]) : decorator.name.trim();
}

export function decoratorSummary(decorator: DotDecorator): string {
	const count =
		decorator.count === "presence"
			? t("dotSummaryPresence")
			: t("dotSummaryPerAmount", { amount: decorator.amountPerDot, what: t(UNIT_LABELS[decorator.source]), max: decorator.maxDots });
	const look = t("dotSummaryLook", {
		shape: t(SHAPE_LABELS[decorator.shape]).toLowerCase(),
		color: t(COLOR_LABELS[decorator.color]).toLowerCase(),
		position: t(POSITION_LABELS[decorator.position]).toLowerCase(),
	});
	const parts = [...(decorator.name.trim() === "" ? [] : [t(SOURCE_LABELS[decorator.source])]), count, look];
	if (decorator.source === "links" && decorator.filters.length > 0) parts.push(t("dotSummaryFilters"));
	if (decorator.cells.length === 1) parts.push(t(decorator.cells[0] === "day" ? "dotSummaryDaysOnly" : "dotSummaryWeeksOnly"));
	if (sourceCanShowWithoutNote(decorator.source) && decorator.showWithoutNote) parts.push(t("dotSummaryWithoutNote"));
	const summary = parts.join(" · ");
	return summary.charAt(0).toLocaleUpperCase() + summary.slice(1);
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
		{
			type: "group",
			items: [
				{ name: t("calendarShowWeekNumbers"), desc: t("calendarShowWeekNumbersDesc"), control: { type: "toggle", key: CALENDAR_SHOW_WEEK_NUMBERS_KEY } },
				{ name: t("calendarConfirmBeforeCreate"), desc: t("calendarConfirmBeforeCreateDesc"), control: { type: "toggle", key: CALENDAR_CONFIRM_BEFORE_CREATE_KEY } },
				{ name: t("calendarThemeCompatibility"), desc: t("calendarThemeCompatibilityDesc"), control: { type: "toggle", key: CALENDAR_THEME_COMPATIBILITY_KEY } },
			],
		},
		{
			type: "group",
			visible: context.sharesRootIdWithOriginalCalendar,
			items: [{ name: t("calendarThemeCompatibilityClash"), desc: t("calendarThemeCompatibilityClashDesc") }],
		},
		decoratorsList(decorators, context),
		{ type: "group", visible: false, items: decorators.map((decorator) => decoratorPage(decorator, context)) },
	];
}

function decoratorsList(decorators: DotDecorator[], context: CalendarPageContext): SettingDefinitionList {
	return {
		type: "list",
		heading: t("dotsList"),
		emptyState: t("noDotsYet"),
		items: decorators.map((decorator) => decoratorRow(decorator, context)),
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

function decoratorRow(decorator: DotDecorator, context: CalendarPageContext): SettingDefinitionRender {
	return {
		name: decoratorName(decorator),
		desc: decoratorSummary(decorator),
		render: (setting) => {
			setting.setName(decoratorName(decorator));
			setting.setDesc(decoratorSummary(decorator));
			setting.addExtraButton((button) =>
				button
					.setIcon("pencil")
					.setTooltip(t("editDots"))
					.onClick(() => context.openPage(decoratorPageId(decorator)))
					.extraSettingsEl.addClass(LIST_ROW_EDIT_CLASS),
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
		items: [
			{ type: "group", items: sourceItems },
			cellsList(decorator, context),
			{
				type: "group",
				heading: t("dotsLook"),
				items: [
					{ name: t("dotsShape"), desc: t("dotsShapeDesc"), control: { type: "dropdown", key: key("shape"), options: translatedLabels(SHAPE_LABELS) } },
					{ name: t("dotsColor"), desc: t("dotsColorDesc"), control: { type: "dropdown", key: key("color"), options: translatedLabels(COLOR_LABELS) } },
					{ name: t("dotsPosition"), desc: t("dotsPositionDesc"), control: { type: "dropdown", key: key("position"), options: translatedLabels(POSITION_LABELS) } },
				],
			},
			...(decorator.source === "links" ? [filtersList(decorator, context)] : []),
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

function filtersList(decorator: DotDecorator, context: CalendarPageContext): SettingDefinitionList {
	const filtersKey = decoratorKey(decorator.id, "filters");
	const { filters } = decorator;
	return {
		type: "list",
		heading: t("linkFilters"),
		emptyState: t("noLinkFiltersYet"),
		items: filters.map((filter, position) => ({
			name: t(FILTER_LABELS[filter.kind]),
			desc: t(FILTER_DESCRIPTIONS[filter.kind]),
			render: (setting) => {
				setting.setName(t(FILTER_LABELS[filter.kind]));
				setting.setDesc(t(FILTER_DESCRIPTIONS[filter.kind]));
				setting.addText((text) =>
					text
						.setPlaceholder(FILTER_PLACEHOLDERS[filter.kind])
						.setValue(filter.value)
						.onChange((value) => {
							const current = decorator.filters;
							context.write(filtersKey, current.map((kept, index) => (index === position ? { ...kept, value } : kept)));
						}),
				);
			},
		})),
		onDelete: (index) => void context.change(() => decorator.filters.splice(index, 1)),
		addItem: {
			name: t("addLinkFilter"),
			action: (anchor: HTMLElement) =>
				context.choose(
					anchor,
					LINK_FILTER_KINDS.map((kind) => ({ value: kind, name: t(FILTER_LABELS[kind]) })),
					(kind) => void context.change(() => decorator.filters.push({ kind, value: "" })),
				),
		},
	};
}
