import { Notice, Plugin, type Editor } from "obsidian";
import { writePlainText } from "./plugin/clipboard";
import { addEditorMenu, type MenuPlatform } from "./plugin/menu";

const PLATFORMS: MenuPlatform[] = [
	{ id: "vcru", menuTitle: "vc.ru", forWhom: "vc.ru" },
	{ id: "dzen", menuTitle: "Дзен", forWhom: "Дзена" },
	{ id: "smartlab", menuTitle: "Смартлаб", forWhom: "Смартлаба" }
];

const EMPTY_NOTICE = "Нечего копировать";
const BUFFER_NOTICE = "Не удалось записать в буфер";

export default class NaborschikPlugin extends Plugin {
	override async onload(): Promise<void> {
		for (const platform of PLATFORMS) {
			this.addCommand({
				id: "copy-for-" + platform.id,
				name: "Копировать для " + platform.forWhom,
				editorCallback: (editor) => this.copyFor(platform, editor)
			});
		}

		this.registerEvent(
			this.app.workspace.on("editor-menu", (menu, editor) => {
				addEditorMenu(menu, PLATFORMS, (platform) => void this.copyFor(platform, editor));
			})
		);
	}

	private async copyFor(platform: MenuPlatform, editor: Editor): Promise<void> {
		const selection = editor.getSelection();
		const source = selection !== "" ? selection : editor.getValue();

		if (source === "") {
			new Notice(EMPTY_NOTICE);
			return;
		}

		const payload = "Для " + platform.forWhom + "\n\n" + source;

		try {
			await writePlainText(payload);
		} catch (error) {
			console.error("naborschik: не удалось записать в буфер", error);
			new Notice(BUFFER_NOTICE);
			return;
		}

		new Notice("Скопировано для " + platform.forWhom + ", символов: " + source.length);
	}
}
