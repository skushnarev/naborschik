import { Menu } from "obsidian";
import type { PlatformAdapter } from "../core/types.ts";

const SUBMENU_TITLE = "Копировать для ...";

export type CopyHandler = (platform: PlatformAdapter) => void;

export function copyLabel(platform: PlatformAdapter): string {
	return "Копировать для " + platform.forWhom;
}

export function addEditorMenu(menu: Menu, platforms: PlatformAdapter[], onCopy: CopyHandler): void {
	if (supportsSubmenu()) {
		addSubmenu(menu, platforms, onCopy);
		return;
	}
	addFlatItems(menu, platforms, onCopy);
}

function addSubmenu(menu: Menu, platforms: PlatformAdapter[], onCopy: CopyHandler): void {
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
				addCopyItem(submenu, platform.title, platform, onCopy);
			}
		});
	} catch (error) {
		// Пункт уже мог попасть в меню, плоские копии дали бы четыре строки.
		console.error("naborschik: подменю не добавилось", error);
	}
}

function supportsSubmenu(): boolean {
	let supported = false;
	new Menu().addItem((item) => {
		supported = typeof item.setSubmenu === "function";
	});
	return supported;
}

function addFlatItems(menu: Menu, platforms: PlatformAdapter[], onCopy: CopyHandler): void {
	for (const platform of platforms) {
		addCopyItem(menu, copyLabel(platform), platform, onCopy);
	}
}

function addCopyItem(
	menu: Menu,
	title: string,
	platform: PlatformAdapter,
	onCopy: CopyHandler
): void {
	menu.addItem((item) => {
		item.setTitle(title);
		if (platform.icon) item.setIcon(platform.icon);
		item.onClick(() => onCopy(platform));
	});
}
