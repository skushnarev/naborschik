const { Notice, Plugin } = require("obsidian");

const PLATFORMS = [
	{ id: "vcru", dative: "vc.ru" },
	{ id: "dzen", dative: "Дзена" },
	{ id: "smartlab", dative: "Смартлаба" }
];

const EMPTY_NOTICE = "Нечего копировать";
const BUFFER_NOTICE = "Не удалось записать в буфер";

class NaborschikPlugin extends Plugin {
	async onload() {
		for (const platform of PLATFORMS) {
			this.addCommand({
				id: "copy-for-" + platform.id,
				name: "Копировать для " + platform.dative,
				editorCallback: (editor) => this.copyFor(platform, editor)
			});
		}
	}

	async copyFor(platform, editor) {
		const selection = editor.getSelection();
		const source = selection !== "" ? selection : editor.getValue();

		if (source.trim() === "") {
			new Notice(EMPTY_NOTICE);
			return;
		}

		const payload = "Для " + platform.dative + "\n\n" + source;

		try {
			await navigator.clipboard.writeText(payload);
		} catch (error) {
			console.error("naborschik: не удалось записать в буфер", error);
			new Notice(BUFFER_NOTICE);
			return;
		}

		new Notice("Скопировано для " + platform.dative + ", символов: " + source.length);
	}
}

module.exports = NaborschikPlugin;
