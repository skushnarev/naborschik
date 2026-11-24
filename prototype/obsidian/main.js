const { Notice, Plugin } = require("obsidian");

const PLATFORMS = [
	{ id: "vcru", label: "vc.ru", dative: "vc.ru" },
	{ id: "dzen", label: "Дзен", dative: "Дзена" },
	{ id: "smartlab", label: "Смартлаб", dative: "Смартлаба" }
];

const EMPTY_NOTICE = "Нечего копировать";
const BUFFER_NOTICE = "Не удалось записать в буфер";

function composePayload(prefix, text) {
	return prefix + "\n\n" + text;
}

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
		const source = selection.trim() !== "" ? selection : editor.getValue();

		if (source.trim() === "") {
			new Notice(EMPTY_NOTICE);
			return;
		}

		const payload = composePayload("Для " + platform.dative, source);

		try {
			await navigator.clipboard.writeText(payload);
		} catch (error) {
			console.error("naborschik: не удалось записать в буфер", error);
			new Notice(BUFFER_NOTICE);
			return;
		}

		new Notice("Скопировано для " + platform.dative + ", символов: " + payload.length);
	}
}

module.exports = NaborschikPlugin;
