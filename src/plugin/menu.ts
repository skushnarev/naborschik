import { Menu } from "obsidian";

/** Если подменю не отрисуется, поставить false: получатся три плоских пункта. */
const USE_SUBMENU = true;

const SUBMENU_TITLE = "Копировать для ...";

export interface MenuPlatform {
	id: string;
	menuTitle: string;
	forWhom: string;
}

export type CopyHandler = (platform: MenuPlatform) => void;

export function addEditorMenu(menu: Menu, platforms: MenuPlatform[], onCopy: CopyHandler): void {
	if (USE_SUBMENU && tryAddSubmenu(menu, platforms, onCopy)) return;
	addFlatItems(menu, platforms, onCopy);
}

function tryAddSubmenu(menu: Menu, platforms: MenuPlatform[], onCopy: CopyHandler): boolean {
	if (!supportsSubmenu()) return false;

	try {
		menu.addItem((item) => {
			item.setTitle(SUBMENU_TITLE);

			// setSubmenu() создаёт подменю сам и не принимает Menu аргументом.
			const setSubmenu = item.setSubmenu;
			if (typeof setSubmenu !== "function") {
				throw new Error("MenuItem.setSubmenu недоступен");
			}

			const submenu = setSubmenu.call(item);
			for (const platform of platforms) {
				addCopyItem(submenu, platform.menuTitle, platform, onCopy);
			}
		});
		return true;
	} catch (error) {
		// Пункт уже мог попасть в меню, плоские копии дали бы четыре строки.
		console.error("naborschik: подменю не добавилось", error);
		return true;
	}
}

function supportsSubmenu(): boolean {
	let supported = false;
	new Menu().addItem((item) => {
		supported = typeof item.setSubmenu === "function";
	});
	return supported;
}

function addFlatItems(menu: Menu, platforms: MenuPlatform[], onCopy: CopyHandler): void {
	for (const platform of platforms) {
		addCopyItem(menu, "Копировать для " + platform.forWhom, platform, onCopy);
	}
}

function addCopyItem(menu: Menu, title: string, platform: MenuPlatform, onCopy: CopyHandler): void {
	menu.addItem((item) => item.setTitle(title).onClick(() => onCopy(platform)));
}
