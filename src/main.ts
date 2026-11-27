import { Notice, Plugin, type Editor } from "obsidian";
import { parse } from "./core/parse.ts";
import type { ClipboardPayload, PlatformAdapter } from "./core/types.ts";
import { writePayload } from "./plugin/clipboard.ts";
import { loadImageResolver } from "./plugin/images.ts";
import { addEditorMenu, copyLabel } from "./plugin/menu.ts";
import { WarningModal } from "./plugin/warning-modal.ts";
import { formatCopyNotice, formatSuccessNotice, summarizeWarnings } from "./plugin/warning-summary.ts";
import { PLATFORMS } from "./platforms/index.ts";

const EMPTY_NOTICE = "Нечего копировать";
const PREPARE_NOTICE = "Не удалось подготовить текст";
const BUFFER_NOTICE = "Не удалось записать в буфер";

export default class NaborschikPlugin extends Plugin {
	override async onload(): Promise<void> {
		for (const platform of PLATFORMS) {
			this.addCommand({
				id: "copy-for-" + platform.id,
				name: copyLabel(platform),
				editorCallback: (editor) => this.copyFor(platform, editor)
			});
		}

		this.registerEvent(
			this.app.workspace.on("editor-menu", (menu, editor) => {
				addEditorMenu(menu, PLATFORMS, (platform) => void this.copyFor(platform, editor));
			})
		);
	}

	private async copyFor(platform: PlatformAdapter, editor: Editor): Promise<void> {
		// Выделение важнее заметки целиком: пустое выделение это сигнал взять всё.
		const selection = editor.getSelection();
		const source = selection !== "" ? selection : editor.getValue();
		const sourcePath = this.app.workspace.getActiveFile()?.path ?? "";
		const images = await loadImageResolver(this.app, source, sourcePath);
		const parsed = parse(source, { images });

		if (parsed.blocks.length === 0) {
			new Notice(EMPTY_NOTICE);
			return;
		}

		const context = { warnings: parsed.warnings };
		let payload: ClipboardPayload;
		try {
			payload = await platform.convert(parsed, context);
		} catch (error) {
			console.error("naborschik: не удалось подготовить текст", error);
			new Notice(PREPARE_NOTICE);
			return;
		}

		for (const warning of context.warnings) {
			console.warn("naborschik: " + warning.code + ": " + warning.message);
		}

		try {
			await writePayload(payload);
		} catch (error) {
			console.error("naborschik: не удалось записать в буфер", error);
			new Notice(BUFFER_NOTICE);
			return;
		}

		const chars = payload.plain.length;
		const summary = summarizeWarnings(context.warnings);
		if (!summary) {
			new Notice(formatSuccessNotice(platform.forWhom, chars));
			return;
		}

		const fragment = createFragment((element) => {
			element.appendText(formatCopyNotice(platform.forWhom, chars, summary) + " ");
			const link = element.createEl("a", { text: "Подробнее", href: "#" });
			link.addEventListener("click", (event) => {
				event.preventDefault();
				event.stopPropagation();
				new WarningModal(this.app, platform.forWhom, summary).open();
			});
		});
		new Notice(fragment, 10000);
	}
}
