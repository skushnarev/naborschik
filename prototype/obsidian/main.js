const { Menu, Notice, Plugin } = require("obsidian");

// Если подменю не отрисуется, поставить false: получатся три плоских пункта.
const USE_SUBMENU = true;

const PLATFORMS = [
	{ id: "vcru", label: "vc.ru", dative: "vc.ru" },
	{ id: "dzen", label: "Дзен", dative: "Дзена" },
	{ id: "smartlab", label: "Смартлаб", dative: "Смартлаба" }
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

		this.registerEvent(
			this.app.workspace.on("editor-menu", (menu, editor) => this.addEditorMenu(menu, editor))
		);
	}

	addEditorMenu(menu, editor) {
		if (USE_SUBMENU && this.addSubmenu(menu, editor)) return;
		this.addFlatItems(menu, editor);
	}

	addSubmenu(menu, editor) {
		const submenu = new Menu();

		for (const platform of PLATFORMS) {
			submenu.addItem((item) =>
				item.setTitle(platform.label).onClick(() => this.copyFor(platform, editor))
			);
		}

		let attached = false;

		menu.addItem((item) => {
			item.setTitle("Копировать для ...").setIcon("copy");
			if (typeof item.setSubmenu !== "function") return;
			item.setSubmenu(submenu);
			attached = true;
		});

		return attached;
	}

	addFlatItems(menu, editor) {
		for (const platform of PLATFORMS) {
			menu.addItem((item) =>
				item
					.setTitle("Копировать для " + platform.dative)
					.onClick(() => this.copyFor(platform, editor))
			);
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
