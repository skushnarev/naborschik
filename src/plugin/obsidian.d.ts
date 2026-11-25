import type { Menu } from "obsidian";

declare module "obsidian" {
	interface MenuItem {
		/**
		 * Создаёт вложенное меню и возвращает его. Аргумент не принимает.
		 * Метод недокументирован, поэтому объявлен необязательным.
		 */
		setSubmenu?(): Menu;
	}
}
