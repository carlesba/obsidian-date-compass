import { ItemView, Keymap, Menu, Platform, debounce } from "obsidian";
import type { HoverParent, HoverPopover, TAbstractFile, WorkspaceLeaf } from "obsidian";
import { openDateNote } from "../dateNotes/commands.ts";
import type { DateNotePane } from "../dateNotes/commands.ts";
import { fileNameParts } from "../dateNotes/paths.ts";
import { t } from "../i18n/index.ts";
import { civilOf } from "../parse/calendar.ts";
import type { CivilDate } from "../parse/calendar.ts";
import type { DateCompassSettings } from "../settings.ts";
import { confirmCreateNote } from "./confirmModal.ts";
import { monthGrid, monthOf, weeksAroundGrid } from "./grid.ts";
import type { MonthGrid } from "./grid.ts";
import { headerParts } from "./header.ts";
import { calendarModel } from "./model.ts";
import type { CalendarModel, NoteTarget } from "./model.ts";
import { anchorAfterDayChange, monthAfterDayChange, sameDay, shiftMonth, shiftWeek, startOfMonthBefore, startOfNextMonth } from "./navigation.ts";
import { createNoteDotsReader, localeWeekRule, momentOf, monthShortName, weekdayShortNames } from "./obsidianHost.ts";
import { activeNoteTouchesVisible, touchesVisible, visibleNotes } from "./paths.ts";
import { renderCalendar } from "./render.ts";
import type { CalendarHandlers } from "./render.ts";
import { todayRowIndex } from "./settings.ts";
import type { CalendarSettings } from "./settings.ts";
import { singleFlight } from "./singleFlight.ts";
import { weekRuleOf } from "./weeks.ts";
import type { WeekRule } from "./weeks.ts";

export const CALENDAR_VIEW_TYPE = "date-compass-calendar";
export const CALENDAR_ICON = "calendar-days";

const ROOT_CLASS = "date-compass-calendar";
const MOBILE_CLASS = "is-mobile";
const DIMS_WITHOUT_NOTE_CLASS = "dims-without-note";
const CONTEXT_MENU_SOURCE = "calendar-context-menu";
const DELETE_ICON = "trash";
const RENDER_DEBOUNCE_MS = 50;
const HEARTBEAT_MS = 60_000;

export class CalendarView extends ItemView implements HoverParent {
	hoverPopover: HoverPopover | null = null;
	private readonly settings: () => DateCompassSettings;
	private readonly root = this.contentEl.createDiv({ cls: Platform.isMobile ? [ROOT_CLASS, MOBILE_CLASS] : ROOT_CLASS });
	private readonly dots = createNoteDotsReader(this.app, (path) => this.noteChanged(path));
	private readonly requestRender = debounce(() => this.renderWhenShown(), RENDER_DEBOUNCE_MS, false);
	private readonly openOncePerPath = singleFlight();
	private readonly handlers: CalendarHandlers = {
		back: () => this.move(-1),
		forward: () => this.move(1),
		jumpBack: () => this.showAnchor(startOfMonthBefore(this.anchor)),
		jumpForward: () => this.showAnchor(startOfNextMonth(this.anchor)),
		today: () => this.showDate(this.today),
		open: (target, event) => this.openNote(target, event),
		hover: (target, event, targetEl) => this.previewNote(target, event, targetEl),
		contextMenu: (target, event) => this.showNoteMenu(target, event),
	};
	private today = civilOf(new Date());
	private displayed = monthOf(this.today);
	private anchor = this.today;
	private visiblePaths: ReadonlySet<string> = new Set<string>();
	private renderedActivePath: string | undefined;
	private awaitsBeingShown = false;

	constructor(leaf: WorkspaceLeaf, settings: () => DateCompassSettings) {
		super(leaf);
		this.settings = settings;
	}

	getViewType(): string {
		return CALENDAR_VIEW_TYPE;
	}

	getDisplayText(): string {
		return t("calendarViewTitle");
	}

	getIcon(): string {
		return CALENDAR_ICON;
	}

	async onOpen(): Promise<void> {
		const { vault, metadataCache, workspace } = this.app;
		this.registerEvent(vault.on("create", (file) => this.noteChanged(file.path)));
		this.registerEvent(vault.on("delete", (file) => this.noteChanged(file.path)));
		this.registerEvent(vault.on("rename", (file: TAbstractFile, oldPath: string) => this.noteChanged(file.path, oldPath)));
		this.registerEvent(metadataCache.on("changed", (file) => this.noteChanged(file.path)));
		this.registerEvent(metadataCache.on("resolved", () => this.linksChanged()));
		this.registerEvent(workspace.on("file-open", () => this.activeNoteChanged()));
		this.registerEvent(workspace.on("active-leaf-change", () => this.activeNoteChanged()));
		this.registerEvent(workspace.on("layout-change", () => this.renderIfAwaited()));
		this.registerInterval(window.setInterval(() => this.heartbeat(), HEARTBEAT_MS));
		const shownObserver = new ResizeObserver(() => this.renderIfAwaited());
		shownObserver.observe(this.contentEl);
		this.register(() => shownObserver.disconnect());
		this.renderWhenShown();
	}

	async onClose(): Promise<void> {
		this.root.empty();
	}

	onResize(): void {
		this.renderIfAwaited();
	}

	refresh(): void {
		this.requestRender();
	}

	showDate(date: CivilDate): void {
		this.displayed = monthOf(date);
		this.anchor = date;
		this.render();
	}

	private move(steps: number): void {
		if (this.settings().calendar.view === "weeks") this.showAnchor(shiftWeek(this.anchor, steps));
		else this.showDate({ ...shiftMonth(this.displayed, steps), day: 1 });
	}

	private showAnchor(anchor: CivilDate): void {
		this.anchor = anchor;
		this.displayed = monthOf(anchor);
		this.render();
	}

	private noteChanged(path: string, oldPath?: string): void {
		if (touchesVisible(this.visiblePaths, path, oldPath)) this.requestRender();
	}

	private linksChanged(): void {
		this.dots.linksChanged();
		if (this.settings().calendar.decorators.some((decorator) => decorator.source === "links")) this.requestRender();
	}

	private activeNoteChanged(): void {
		if (activeNoteTouchesVisible(this.visiblePaths, this.app.workspace.getActiveFile()?.path, this.renderedActivePath)) this.requestRender();
	}

	private heartbeat(): void {
		if (this.followToday()) this.requestRender();
		else this.renderIfAwaited();
	}

	private followToday(): boolean {
		const now = civilOf(new Date());
		if (sameDay(now, this.today)) return false;
		this.displayed = monthAfterDayChange(this.displayed, this.today, now);
		this.anchor = anchorAfterDayChange(this.anchor, this.today, now);
		this.today = now;
		return true;
	}

	private isShown(): boolean {
		return this.contentEl.isShown() && this.contentEl.offsetWidth > 0;
	}

	private renderIfAwaited(): void {
		if (this.awaitsBeingShown) this.renderWhenShown();
	}

	private renderWhenShown(): void {
		if (this.isShown()) this.render();
		else this.awaitsBeingShown = true;
	}

	private render(): void {
		this.awaitsBeingShown = false;
		this.followToday();
		const settings = this.settings();
		const { periods } = settings.dateNotes;
		const { calendar } = settings;
		const { decorators } = calendar;
		const rule = weekRuleOf(settings.weekStart, localeWeekRule());
		const activePath = this.app.workspace.getActiveFile()?.path;
		const visiblePaths = new Set<string>();
		const modelOf = (grid: MonthGrid): CalendarModel => {
			const notes = visibleNotes(grid, periods, momentOf);
			for (const path of notes.visiblePaths) visiblePaths.add(path);
			return calendarModel({
				grid,
				today: this.today,
				notes,
				parts: headerParts(grid.month, monthShortName(grid.month), periods),
				rule,
				weekdayNames: weekdayShortNames(),
				showWeekNumbers: calendar.showWeekNumbers,
				activePath,
				noteExists: (path) => this.app.vault.getFileByPath(path) !== null,
				showsDotsAbove: decorators.some((decorator) => decorator.position === "above"),
				dotsOf: (path, place, hasNote) => this.dots.dotsOf(path, place, hasNote, decorators),
			});
		};
		const months = this.grids(calendar, rule).map(modelOf);
		this.visiblePaths = visiblePaths;
		this.renderedActivePath = activePath;
		this.root.empty();
		this.root.toggleClass(DIMS_WITHOUT_NOTE_CLASS, calendar.dimWithoutNote);
		renderCalendar(this.root, { step: calendar.view === "weeks" ? "week" : "month", months }, this.handlers);
	}

	private grids(calendar: CalendarSettings, rule: WeekRule): MonthGrid[] {
		if (calendar.view === "weeks") return [weeksAroundGrid(this.anchor, calendar.weeksShown, todayRowIndex(calendar.todayRow, calendar.weeksShown), rule, this.today)];
		const last = calendar.monthsShown - 1;
		return Array.from({ length: calendar.monthsShown }, (_, index) =>
			monthGrid(shiftMonth(this.displayed, index), rule, this.today, { before: index === 0 ? calendar.weeksBefore : 0, after: index === last ? calendar.weeksAfter : 0 }),
		);
	}

	private openNote(target: NoteTarget, event: MouseEvent): void {
		const pane = Keymap.isModEvent(event) ? "split" : "current";
		void this.openOncePerPath(target.path, () => this.openOrCreateNote(target, pane));
	}

	private async openOrCreateNote(target: NoteTarget, pane: DateNotePane): Promise<void> {
		const settings = this.settings();
		const needsConfirmation = settings.calendar.confirmBeforeCreate && !this.app.vault.getFileByPath(target.path);
		if (needsConfirmation && !(await confirmCreateNote(this.app, fileNameParts(target.path).basename))) return;
		await openDateNote(this.app, settings.dateNotes, momentOf(target.date), target.period, pane);
	}

	private previewNote(target: NoteTarget, event: MouseEvent, targetEl: HTMLElement): void {
		this.app.workspace.trigger("hover-link", {
			event,
			source: CALENDAR_VIEW_TYPE,
			hoverParent: this,
			targetEl,
			linktext: target.path,
			sourcePath: "",
		});
	}

	private showNoteMenu(target: NoteTarget, event: MouseEvent): void {
		const file = this.app.vault.getFileByPath(target.path);
		if (!file) return;
		event.preventDefault();
		const menu = new Menu();
		menu.addItem((item) =>
			item
				.setTitle(t("deleteNote"))
				.setIcon(DELETE_ICON)
				.onClick(() => void this.app.fileManager.promptForDeletion(file)),
		);
		this.app.workspace.trigger("file-menu", menu, file, CONTEXT_MENU_SOURCE, this.leaf);
		menu.showAtMouseEvent(event);
	}
}
