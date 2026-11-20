import { ItemView, Keymap, Platform, debounce } from "obsidian";
import type { Events, HoverParent, HoverPopover, TAbstractFile, ViewStateResult, WorkspaceLeaf } from "obsidian";
import { t } from "../i18n/index.ts";
import type { TranslationKey } from "../i18n/index.ts";
import { civilOf } from "../parse/calendar.ts";
import type { DateCompassSettings } from "../settings.ts";
import { createNoteDotsReader, localeWeekRule } from "./obsidianHost.ts";
import { renderAgenda } from "./agendaList.ts";
import type { AgendaHandlers } from "./agendaList.ts";
import { AGENDA_SCOPES } from "./agenda.ts";
import type { AgendaScope, SelectedDateNote } from "./agenda.ts";
import { agendaOf, calendarModels, dotName, focusedDateNote, noteName } from "./screen.ts";
import type { ScreenContext } from "./screen.ts";
import { CALENDAR_RENDERED_EVENT, CALENDAR_VIEW_TYPE, CalendarView } from "./view.ts";
import { weekRuleOf } from "./weeks.ts";

export const AGENDA_VIEW_TYPE = "date-compass-agenda";
export const AGENDA_ICON = "calendar-search";

const ROOT_CLASSES = ["date-compass-calendar", "date-compass-agenda-view"];
const MOBILE_CLASS = "is-mobile";
const RENDER_DEBOUNCE_MS = 50;

const SCOPE_LABELS: Record<AgendaScope, TranslationKey> = {
	selected: "agendaSelected",
	visible: "agendaVisible",
};

interface AgendaViewState {
	scope?: unknown;
}

export class AgendaView extends ItemView implements HoverParent {
	hoverPopover: HoverPopover | null = null;
	private readonly settings: () => DateCompassSettings;
	private readonly root = this.contentEl.createDiv({ cls: Platform.isMobile ? [...ROOT_CLASSES, MOBILE_CLASS] : ROOT_CLASSES });
	private readonly dots = createNoteDotsReader(this.app, () => this.requestRender());
	private readonly requestRender = debounce(() => this.render(), RENDER_DEBOUNCE_MS, false);
	private readonly handlers: AgendaHandlers = {
		open: (notePath, event) => void this.app.workspace.openLinkText(notePath, "", Keymap.isModEvent(event)),
		hover: (notePath, event, targetEl) =>
			this.app.workspace.trigger("hover-link", { event, source: AGENDA_VIEW_TYPE, hoverParent: this, targetEl, linktext: notePath, sourcePath: "" }),
		dotName: (decoratorId) => dotName(this.settings(), decoratorId),
	};
	private listScope: AgendaScope = "selected";
	private selected: SelectedDateNote | undefined;

	constructor(leaf: WorkspaceLeaf, settings: () => DateCompassSettings) {
		super(leaf);
		this.settings = settings;
	}

	getViewType(): string {
		return AGENDA_VIEW_TYPE;
	}

	getDisplayText(): string {
		return t("agendaViewTitle");
	}

	getIcon(): string {
		return AGENDA_ICON;
	}

	getState(): Record<string, unknown> {
		return { ...super.getState(), scope: this.listScope };
	}

	async setState(state: AgendaViewState, result: ViewStateResult): Promise<void> {
		const scope = AGENDA_SCOPES.find((candidate) => candidate === state.scope);
		if (scope) this.listScope = scope;
		await super.setState(state, result);
		this.render();
	}

	async onOpen(): Promise<void> {
		const { vault, metadataCache, workspace } = this.app;
		const changed = (path: string, oldPath?: string) => {
			this.dots.noteChanged(path, oldPath);
			this.requestRender();
		};
		this.registerEvent(vault.on("create", (file) => changed(file.path)));
		this.registerEvent(vault.on("delete", (file) => changed(file.path)));
		this.registerEvent(vault.on("rename", (file: TAbstractFile, oldPath: string) => changed(file.path, oldPath)));
		this.registerEvent(metadataCache.on("changed", (file) => changed(file.path)));
		this.registerEvent(
			metadataCache.on("resolved", () => {
				this.dots.linksChanged();
				this.requestRender();
			}),
		);
		this.registerEvent(workspace.on("file-open", () => this.activeNoteChanged()));
		this.registerEvent(workspace.on("active-leaf-change", () => this.activeNoteChanged()));
		this.registerEvent(
			(workspace as Events).on(CALENDAR_RENDERED_EVENT, () => {
				if (this.listScope === "visible") this.requestRender();
			}),
		);
		this.selected = focusedDateNote(this.app, this.settings());
		this.render();
	}

	async onClose(): Promise<void> {
		this.root.empty();
	}

	refresh(): void {
		this.requestRender();
	}

	private activeNoteChanged(): void {
		const focused = focusedDateNote(this.app, this.settings());
		if (!focused || focused.path === this.selected?.path) return;
		this.selected = focused;
		if (this.listScope === "selected") this.requestRender();
	}

	private chooseScope(scope: AgendaScope): void {
		if (scope === this.listScope) return;
		this.listScope = scope;
		this.app.workspace.requestSaveLayout();
		this.render();
	}

	private render(): void {
		const settings = this.settings();
		const context: ScreenContext = {
			app: this.app,
			settings,
			dots: this.dots,
			today: civilOf(new Date()),
			rule: weekRuleOf(settings.weekStart, localeWeekRule()),
			activePath: this.app.workspace.getActiveFile()?.path,
		};
		this.root.empty();
		this.renderScope();
		const calendar = this.calendar();
		const visible = this.listScope === "visible" && calendar ? calendarModels(context, calendar.visibleGrids(), settings.calendar.showWeekNumbers).models : [];
		const { rows } = agendaOf(context, this.listScope, visible, this.selected);
		renderAgenda(this.root, rows, t(this.emptyText(calendar !== undefined)), (path) => noteName(this.app, path), this.handlers);
	}

	private emptyText(calendarOpen: boolean): TranslationKey {
		if (this.listScope === "visible") return calendarOpen ? "agendaNone" : "agendaNoCalendar";
		return this.selected ? "agendaNone" : "agendaNoSelection";
	}

	private renderScope(): void {
		const scopeEl = this.root.createDiv({ cls: "scope" });
		for (const scope of AGENDA_SCOPES) {
			const button = scopeEl.createEl("button", { text: t(SCOPE_LABELS[scope]), cls: scope === this.listScope ? "is-active" : undefined });
			button.addEventListener("click", () => this.chooseScope(scope));
		}
	}

	private calendar(): CalendarView | undefined {
		const view = this.app.workspace.getLeavesOfType(CALENDAR_VIEW_TYPE)[0]?.view;
		return view instanceof CalendarView ? view : undefined;
	}
}
