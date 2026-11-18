import { Modal, Setting } from "obsidian";
import type { App } from "obsidian";
import { t } from "../i18n/index.ts";

export class ConfirmCreateNoteModal extends Modal {
	private readonly file: string;
	private readonly create: () => void;

	constructor(app: App, file: string, create: () => void) {
		super(app);
		this.file = file;
		this.create = create;
	}

	onOpen(): void {
		this.setTitle(t("createNoteTitle"));
		this.contentEl.createEl("p", { text: t("createNoteMessage", { file: this.file }) });
		new Setting(this.contentEl)
			.addButton((button) => button.setButtonText(t("cancel")).onClick(() => this.close()))
			.addButton((button) =>
				button
					.setButtonText(t("create"))
					.setCta()
					.onClick(() => {
						this.close();
						this.create();
					}),
			);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
