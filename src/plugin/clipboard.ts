import type { ClipboardPayload } from "../core/types.ts";

/**
 * Запись готового payload в системный буфер.
 *
 * Если адаптер дал HTML, пишем `ClipboardItem` с `text/html` и `text/plain`.
 * Без HTML, без `ClipboardItem` или при сбое rich-вставки откатываемся
 * на обычный `writeText`, чтобы копирование не пропало.
 */
export async function writePayload(payload: ClipboardPayload): Promise<void> {
	const clipboard = navigator.clipboard;

	if (payload.html && typeof ClipboardItem !== "undefined" && typeof clipboard.write === "function") {
		try {
			await clipboard.write([
				new ClipboardItem({
					"text/html": new Blob([payload.html], { type: "text/html" }),
					"text/plain": new Blob([payload.plain], { type: "text/plain" })
				})
			]);
			return;
		} catch (error) {
			console.error("naborschik: rich-вставка не удалась, пишу text/plain", error);
		}
	}

	await clipboard.writeText(payload.plain);
}
