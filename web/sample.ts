import { createImageEntry, type ImageEntry } from "./images.ts";

/**
 * Встроенная картинка режима примера: `test/fixtures/star.png` (106 байт).
 * Лежит в бандле как data URI, чтобы пример сразу показывал img без выбора файла.
 */
export const SAMPLE_IMAGE_SRC =
	"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMUlEQVR42mNgGNTgmZvafxAeogbANBNtCLoGQpgiQ8h2Ddn+p68B2DSQ5X+qJ6rBCwDXyor9t1yssgAAAABJRU5ErkJggg==";

export function sampleImageEntry(): ImageEntry {
	const entry = createImageEntry("star.png", decodeBase64(SAMPLE_IMAGE_SRC));
	if (!entry) throw new Error("Встроенная картинка примера не читается");
	return { ...entry, sample: true };
}

function decodeBase64(value: string): Uint8Array {
	const binary = atob(value.slice(value.indexOf(",") + 1));
	const bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index += 1) {
		bytes[index] = binary.charCodeAt(index);
	}
	return bytes;
}
