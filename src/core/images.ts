import { imageWidth } from "./image-size.ts";
import type { ImageAsset, ImageResolver } from "./types.ts";

export type ImageEmbed = {
	raw: string;
	target: string;
	width: number | null;
};

export type ImageFile = {
	path: string;
	bytes: Uint8Array;
};

export type ImageFileLoader = (target: string) => Promise<ImageFile | null>;

/**
 * Цели вставок `![[...]]` в порядке появления и без повторов.
 * Позволяет обвязке заранее прочитать файлы, а `parse` оставить синхронным.
 */
export function imageTargets(markdown: string): string[] {
	const targets: string[] = [];
	const seen = new Set<string>();

	replaceImageEmbeds(markdown, (embed) => {
		if (isImagePath(embed.target) && !seen.has(embed.target)) {
			seen.add(embed.target);
			targets.push(embed.target);
		}
		return "";
	});

	return targets;
}

/** Заменяет вставки `![[...]]` через разобранную модель, чтобы не дублировать синтаксис. */
export function replaceImageEmbeds(markdown: string, replacer: (embed: ImageEmbed) => string): string {
	return String(markdown).replace(/!\[\[[^\]]*\]\]/g, (match) => {
		const embed = parseImageEmbed(match);
		return embed ? replacer(embed) : match;
	});
}

/** Путь, ширина из `|64` и исходная строка вставки. */
export function parseImageEmbed(value: string): ImageEmbed | null {
	const raw = String(value).trim();
	const match = raw.match(/^!\[\[([^\]]*)\]\]$/);
	if (!match) return null;

	const parts = (match[1] ?? "").split("|");
	const target = (parts.shift() ?? "").trim();
	if (!target) return null;

	let width: number | null = null;
	for (const part of parts) {
		const size = part.trim();
		if (/^\d+$/.test(size)) width = Number(size);
	}

	return { raw, target, width };
}

// svg и avif не несут растровых размеров в заголовке: width останется null,
// но img с data URI всё равно валиден.
const MIME: Record<string, string> = {
	png: "image/png",
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	gif: "image/gif",
	webp: "image/webp",
	avif: "image/avif",
	bmp: "image/bmp",
	svg: "image/svg+xml"
};

export function isImagePath(path: string): boolean {
	return imageMime(path) !== null;
}

/** Картинка из хранилища в data URI и ширина по байтам файла. */
export function toImageAsset(path: string, bytes: Uint8Array): ImageAsset | null {
	const mime = imageMime(path);
	if (!mime) return null;

	return {
		src: "data:" + mime + ";base64," + base64(bytes),
		width: imageWidth(bytes)
	};
}

/**
 * Резолвер из заранее найденных целей. Обвязка читает файлы сама,
 * разбор получает карту по цели вставки: полному пути или имени файла.
 */
export async function resolveImages(targets: string[], loadFile: ImageFileLoader): Promise<ImageResolver> {
	const assets = new Map<string, ImageAsset>();

	for (const target of targets) {
		const file = await loadFile(target);
		if (!file) continue;

		const asset = toImageAsset(file.path, file.bytes);
		if (asset) assets.set(target, asset);
	}

	return (name) => assets.get(name) ?? null;
}

function imageMime(path: string): string | null {
	const extension = String(path).split(".").pop()?.toLowerCase() ?? "";
	return Object.prototype.hasOwnProperty.call(MIME, extension) ? MIME[extension] ?? null : null;
}

function base64(bytes: Uint8Array): string {
	const parts: string[] = [];
	const chunk = 0x8000;

	for (let index = 0; index < bytes.length; index += chunk) {
		parts.push(String.fromCharCode(...bytes.subarray(index, index + chunk)));
	}

	return btoa(parts.join(""));
}
