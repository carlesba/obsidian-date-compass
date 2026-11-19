import { ItemView, Keymap, Menu, Platform, debounce } from "obsidian";
import type { HoverParent, HoverPopover, TAbstractFile, WorkspaceLeaf } from "obsidian";
import { openDateNote } from "../dateNotes/commands.ts";
import type { DateNotePane } from "../dateNotes/commands.ts";
import { fileNameParts } from "../dateNotes/paths.ts";
import { t } from "../i18n/index.ts";
import { civilOf } from "../parse/calendar.ts";
import type { DateCompassSettings } from "../settings.ts";
import { confirmCreateNote } from "./confirmModal.ts";
import { monthGrid, monthOf } from "./grid.ts";
import type { CivilMonth } from "./grid.ts";
import { headerParts } from "./header.ts";
import { calendarModel } from "./model.ts";
import type { NoteTarget } from "./model.ts";
import { monthAfterDayChange, sameDay, shiftMonth } from "./navigation.ts";
import { createNoteDotsReader, localeWeekRule, momentOf, monthShortName, weekdayShortNames } from "./obsidianHost.ts";
import { activeNoteTouchesVisible, touchesVisible, visibleNotes } from "./paths.ts";
import { renderCalendar } from "./render.ts";
import type { CalendarHandlers } from "./render.ts";
import { singleFlight } from "./singleFlight.ts";
import { weekRuleOf } from "./weeks.ts";

export const CALENDAR_VIEW_TYPE = "date-compass-calendar";
export const CALENDAR_ICON = "calendar-days";

const ROOT_CLASS = "date-compass-calendar";
const MOBILE_CLASS = "is-mobile";
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
		previousMonth: () => this.showMonth(shiftMonth(this.displayed, -1)),
		nextMonth: () => this.showMonth(shiftMonth(this.displayed, 1)),
		currentMonth: () => this.showMonth(monthOf(this.today)),
		open: (target, event) => this.openNote(target, event),
		hover: (target, event, targetEl) => this.previewNote(target, event, targetEl),
		contextMenu: (target, event) => this.showNoteMenu(target, event),
	};
	private today = civilOf(new Date());
	private displayed = monthOf(this.today);
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

	showMonth(month: CivilMonth): void {
		this.displayed = { year: month.year, month: month.month };
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
		const { decorators } = settings.calendar;
		const rule = weekRuleOf(settings.weekStart, localeWeekRule());
		const grid = monthGrid(this.displayed, rule, this.today);
		const notes = visibleNotes(grid, periods, momentOf);
		const activePath = this.app.workspace.getActiveFile()?.path;
		this.visiblePaths = notes.visiblePaths;
		this.renderedActivePath = activePath;
		const model = calendarModel({
			grid,
			today: this.today,
			notes,
			parts: headerParts(this.displayed, monthShortName(this.displayed), periods),
			rule,
			weekdayNames: weekdayShortNames(),
			showWeekNumbers: settings.calendar.showWeekNumbers,
			activePath,
			noteExists: (path) => this.app.vault.getFileByPath(path) !== null,
			showsDotsAbove: decorators.some((decorator) => decorator.position === "above"),
			dotsOf: (path, place, hasNote) => this.dots.dotsOf(path, place, hasNote, decorators),
		});
		this.root.empty();
		renderCalendar(this.root, model, this.handlers);
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
