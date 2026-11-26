/**
 * Ширина картинки по байтам файла. Obsidian не отдаёт размеры через SDK,
 * поэтому читаем только заголовки форматов, которые встречаются в хранилище.
 */
export function imageWidth(bytes: Uint8Array): number | null {
	return pngWidth(bytes) ?? gifWidth(bytes) ?? jpegWidth(bytes) ?? webpWidth(bytes) ?? bmpWidth(bytes);
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function pngWidth(bytes: Uint8Array): number | null {
	if (!matches(bytes, 0, PNG_SIGNATURE)) return null;
	return positive(uint(bytes, 16, 4));
}

function gifWidth(bytes: Uint8Array): number | null {
	if (!matches(bytes, 0, [0x47, 0x49, 0x46, 0x38])) return null;
	const version = bytes[4];
	if (version !== 0x37 && version !== 0x39) return null;
	return positive(uint(bytes, 6, 2, true));
}

function jpegWidth(bytes: Uint8Array): number | null {
	if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;

	let offset = 2;
	while (offset + 1 < bytes.length) {
		if (bytes[offset] !== 0xff) return null;

		let marker = bytes[offset + 1];
		offset += 2;

		// Заполнители 0xFF перед маркером допустимы.
		while (marker === 0xff) {
			marker = bytes[offset];
			offset += 1;
		}
		if (marker === undefined) return null;

		// Маркеры без сегмента длины.
		if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
		if (marker === 0xd9) return null;

		const length = uint(bytes, offset, 2);
		if (length === null || length < 2) return null;
		if (isStartOfFrame(marker)) return positive(uint(bytes, offset + 5, 2));

		offset += length;
	}

	return null;
}

function isStartOfFrame(marker: number): boolean {
	return (
		(marker >= 0xc0 && marker <= 0xc3) ||
		(marker >= 0xc5 && marker <= 0xc7) ||
		(marker >= 0xc9 && marker <= 0xcb) ||
		(marker >= 0xcd && marker <= 0xcf)
	);
}

function webpWidth(bytes: Uint8Array): number | null {
	if (!matches(bytes, 0, [0x52, 0x49, 0x46, 0x46])) return null;
	if (!matches(bytes, 8, [0x57, 0x45, 0x42, 0x50])) return null;

	if (matches(bytes, 12, [0x56, 0x50, 0x38, 0x58])) {
		const width = uint(bytes, 24, 3, true);
		return width === null ? null : width + 1;
	}

	if (matches(bytes, 12, [0x56, 0x50, 0x38, 0x4c])) {
		const low = bytes[21];
		const high = bytes[22];
		if (low === undefined || high === undefined) return null;
		return 1 + (((high & 0x3f) << 8) | low);
	}

	if (matches(bytes, 12, [0x56, 0x50, 0x38, 0x20])) {
		if (!matches(bytes, 23, [0x9d, 0x01, 0x2a])) return null;
		const width = uint(bytes, 26, 2, true);
		return width === null ? null : positive(width & 0x3fff);
	}

	return null;
}

function bmpWidth(bytes: Uint8Array): number | null {
	if (!matches(bytes, 0, [0x42, 0x4d])) return null;
	const width = uint(bytes, 18, 4, true);
	return width !== null && (width | 0) > 0 ? width : null;
}

function matches(bytes: Uint8Array, offset: number, expected: number[]): boolean {
	return expected.every((value, index) => bytes[offset + index] === value);
}

function positive(value: number | null): number | null {
	return value !== null && value > 0 ? value : null;
}

/** Big-endian по умолчанию, little-endian по флагу. */
function uint(bytes: Uint8Array, offset: number, length: number, littleEndian = false): number | null {
	let value = 0;

	for (let index = 0; index < length; index += 1) {
		const position = littleEndian ? offset + length - 1 - index : offset + index;
		const byte = bytes[position];
		if (byte === undefined) return null;
		value = value * 256 + byte;
	}

	return value;
}
