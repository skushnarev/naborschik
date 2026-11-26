import type { App, TFile } from "obsidian";
import { imageTargets, isImagePath, resolveImages } from "../core/images.ts";
import type { ImageResolver } from "../core/types.ts";

/**
 * Читает картинки из хранилища заранее: `parse` остаётся синхронным.
 * Ссылку разрешает Obsidian, поэтому файл находится и по полному пути,
 * и по имени с учётом настроек вложений. Поиск по всему хранилищу не нужен.
 */
export async function loadImageResolver(app: App, markdown: string, sourcePath: string): Promise<ImageResolver> {
	const targets = imageTargets(markdown).filter(isImagePath);

	return resolveImages(targets, async (target) => {
		const file = findFile(app, target, sourcePath);
		if (!file) return null;

		try {
			return { path: file.path, bytes: new Uint8Array(await app.vault.readBinary(file)) };
		} catch (error) {
			// Сбой чтения равноценен ненайденному файлу: разбор оставит текст и предупреждение.
			console.warn("naborschik: не удалось прочитать картинку " + file.path, error);
			return null;
		}
	});
}

function findFile(app: App, target: string, sourcePath: string): TFile | null {
	const linked = app.metadataCache.getFirstLinkpathDest(target, sourcePath);
	return isFile(linked) ? linked : null;
}

// Папка не имеет расширения, а TFile имеет. Проверка структурная,
// чтобы модуль можно было покрыть тестами без Obsidian и Electron.
function isFile(value: unknown): value is TFile {
	return typeof value === "object" && value !== null && "extension" in value && "path" in value;
}
