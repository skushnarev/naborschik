import { Modal, type App } from "obsidian";
import type { WarningSummary } from "./warning-summary.ts";

/** Подробности предупреждений: Notice не подходит для списка файлов и советов. */
export class WarningModal extends Modal {
	private readonly forWhom: string;
	private readonly summary: WarningSummary;

	constructor(app: App, forWhom: string, summary: WarningSummary) {
		super(app);
		this.forWhom = forWhom;
		this.summary = summary;
	}

	override onOpen(): void {
		this.setTitle("Предупреждения при копировании для " + this.forWhom);

		const list = this.contentEl.createEl("ul");
		for (const group of this.summary.groups) {
			const item = list.createEl("li");
			const title = group.count > 1 ? group.title + " (" + group.count + ")" : group.title;
			item.createEl("strong", { text: title });
			item.createEl("div", { text: group.detail });
		}
	}

	override onClose(): void {
		this.contentEl.empty();
	}
}
