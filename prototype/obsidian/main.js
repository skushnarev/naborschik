const { Menu, Notice, Plugin } = require("obsidian");

// Если подменю не отрисуется, поставить false: получатся три плоских пункта.
const USE_SUBMENU = true;

const PLATFORMS = [
	{ id: "vcru", menuTitle: "vc.ru", forWhom: "vc.ru" },
	{ id: "dzen", menuTitle: "Дзен", forWhom: "Дзена" },
	{ id: "smartlab", menuTitle: "Смартлаб", forWhom: "Смартлаба" }
];

const EMPTY_NOTICE = "Нечего копировать";
const BUFFER_NOTICE = "Не удалось записать в буфер";

class NaborschikPlugin extends Plugin {
	async onload() {
		for (const platform of PLATFORMS) {
			this.addCommand({
				id: "copy-for-" + platform.id,
				name: "Копировать для " + platform.forWhom,
				editorCallback: (editor) => this.copyFor(platform, editor)
			});
		}

		this.registerEvent(
			this.app.workspace.on("editor-menu", (menu, editor) => this.addEditorMenu(menu, editor))
		);
	}

	addEditorMenu(menu, editor) {
		if (USE_SUBMENU && this.tryAddSubmenu(menu, editor)) return;
		this.addFlatItems(menu, editor);
	}

	tryAddSubmenu(menu, editor) {
		if (!this.supportsSubmenu()) return false;

		const submenu = new Menu();

		for (const platform of PLATFORMS) {
			this.addCopyItem(submenu, platform.menuTitle, platform, editor);
		}

		try {
			menu.addItem((item) => {
				item.setTitle("Копировать для ...").setSubmenu(submenu);
			});
			return true;
		} catch (error) {
			// Пункт уже мог попасть в меню, плоские копии дали бы четыре строки.
			console.error("naborschik: подменю не добавилось", error);
			return true;
		}
	}

	supportsSubmenu() {
		let supported = false;
		new Menu().addItem((item) => {
			supported = typeof item.setSubmenu === "function";
		});
		return supported;
	}

	addFlatItems(menu, editor) {
		for (const platform of PLATFORMS) {
			this.addCopyItem(menu, "Копировать для " + platform.forWhom, platform, editor);
		}
	}

	addCopyItem(menu, title, platform, editor) {
		menu.addItem((item) => item.setTitle(title).onClick(() => this.copyFor(platform, editor)));
	}

	async copyFor(platform, editor) {
		const selection = editor.getSelection();
		const source = selection !== "" ? selection : editor.getValue();

		if (source === "") {
			new Notice(EMPTY_NOTICE);
			return;
		}

		const payload = "Для " + platform.forWhom + "\n\n" + source;

		try {
			await navigator.clipboard.writeText(payload);
		} catch (error) {
			console.error("naborschik: не удалось записать в буфер", error);
			new Notice(BUFFER_NOTICE);
			return;
		}

		new Notice("Скопировано для " + platform.forWhom + ", символов: " + source.length);
	}
}

module.exports = NaborschikPlugin;
