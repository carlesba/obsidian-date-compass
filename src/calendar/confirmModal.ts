import { Modal, Setting } from "obsidian";
import type { App } from "obsidian";
import { t } from "../i18n/index.ts";

export function confirmCreateNote(app: App, file: string): Promise<boolean> {
	return new Promise((resolve) => new ConfirmCreateNoteModal(app, file, resolve).open());
}

class ConfirmCreateNoteModal extends Modal {
	private readonly file: string;
	private readonly answer: (create: boolean) => void;
	private confirmed = false;

	constructor(app: App, file: string, answer: (create: boolean) => void) {
		super(app);
		this.file = file;
		this.answer = answer;
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
						this.confirmed = true;
						this.close();
					}),
			);
	}

	onClose(): void {
		this.contentEl.empty();
		this.answer(this.confirmed);
	}
}
