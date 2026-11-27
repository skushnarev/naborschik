import { imageTargets, toImageAsset } from "../src/core/images.ts";
import type { ImageAsset, ImageResolver } from "../src/core/types.ts";

/** Файл картинки, выбранный в браузере: путь, имя для показа и готовый data URI. */
export type ImageEntry = {
	/** Нормализованный путь: прямые слэши, без ведущего `./`, нижний регистр. */
	path: string;
	/** Имя файла для интерфейса, регистр сохраняется. */
	name: string;
	size: number;
	asset: ImageAsset;
	sample?: boolean;
};

type Lookup = {
	byPath: Map<string, ImageEntry>;
	byName: Map<string, ImageEntry | null>;
	/** Нормализованные имена, под которые подходят два и больше файлов. */
	duplicates: Set<string>;
};

/**
 * Файл браузера в запись для матчера. Не картинка и неподдерживаемый формат
 * дают `null`: вызывающий сам решает, показать сообщение или пропустить.
 */
export function createImageEntry(path: string, bytes: Uint8Array): ImageEntry | null {
	const asset = toImageAsset(path, bytes);
	if (!asset) return null;

	return {
		path: normalizeImagePath(path),
		name: imageName(path),
		size: bytes.length,
		asset
	};
}

/** Регистр, обратные слэши и ведущий `./` не должны мешать совпадению. */
export function normalizeImagePath(value: string): string {
	return String(value).replace(/\\/g, "/").replace(/^(\.\/)+/, "").toLowerCase();
}

/** Имя файла без папки в исходном регистре. */
export function imageName(value: string): string {
	const parts = String(value).replace(/\\/g, "/").split("/");
	return parts[parts.length - 1] ?? "";
}

/**
 * Резолвер для `parse`: сначала путь, если он совпал, потом уникальное имя.
 * Одинаковые имена в разных папках по имени не подставляются: угадывать нельзя.
 */
export function createImageResolver(entries: ImageEntry[]): ImageResolver {
	const lookup = buildLookup(entries);
	const cache = new Map<string, ImageAsset | null>();

	return (target) => {
		if (!cache.has(target)) cache.set(target, findImage(lookup, target)?.asset ?? null);
		return cache.get(target) ?? null;
	};
}

/**
 * Добавляет выбранные файлы к набору. Встроенная картинка примера уступает
 * своему файлу с тем же именем, а повторный выбор того же пути заменяет запись.
 */
export function mergeImageEntries(existing: ImageEntry[], incoming: ImageEntry[]): ImageEntry[] {
	const incomingNames = new Set(incoming.map((entry) => normalizeImagePath(entry.name)));
	const incomingPaths = new Set(incoming.map((entry) => entry.path));

	const kept = existing.filter(
		(entry) => !incomingPaths.has(entry.path) && !(entry.sample && incomingNames.has(normalizeImagePath(entry.name)))
	);
	const merged = [...kept];

	for (const entry of incoming) {
		if (!merged.some((item) => item.path === entry.path)) merged.push(entry);
	}

	return merged;
}

export type ImageSummary = {
	/** Цели `![[...]]`, которые выглядят как картинки, без повторов. */
	targets: string[];
	matched: number;
	unmatched: string[];
	/** Имена, под которые подходят два и больше выбранных файла. */
	ambiguous: string[];
	totalSize: number;
};

/** Что показать в строке «Картинки»: счётчик, ненайденные имена и общий вес. */
export function summarizeImages(entries: ImageEntry[], markdown: string): ImageSummary {
	const lookup = buildLookup(entries);
	const targets = imageTargets(markdown);
	const unmatched: string[] = [];
	let matched = 0;

	for (const target of targets) {
		if (findImage(lookup, target)) {
			matched += 1;
			continue;
		}

		unmatched.push(target);
	}

	return {
		targets,
		matched,
		unmatched,
		ambiguous: [...lookup.duplicates].map(
			(key) => entries.find((entry) => normalizeImagePath(entry.name) === key)?.name ?? key
		),
		totalSize: entries.reduce((sum, entry) => sum + entry.size, 0)
	};
}

function buildLookup(entries: ImageEntry[]): Lookup {
	const byPath = new Map<string, ImageEntry>();
	const names = new Map<string, ImageEntry[]>();
	const duplicates = new Set<string>();

	for (const entry of entries) {
		byPath.set(entry.path, entry);
		const key = normalizeImagePath(entry.name);
		const list = names.get(key) ?? [];
		if (list.length > 0) duplicates.add(key);
		list.push(entry);
		names.set(key, list);
	}

	const byName = new Map<string, ImageEntry | null>();
	for (const [name, list] of names) {
		byName.set(name, list.length === 1 ? list[0] ?? null : null);
	}

	return { byPath, byName, duplicates };
}

function findImage(lookup: Lookup, target: string): ImageEntry | null {
	const path = normalizeImagePath(target);
	const byPath = lookup.byPath.get(path);
	if (byPath) return byPath;

	return lookup.byName.get(normalizeImagePath(imageName(path))) ?? null;
}
