/**
 * Запись готового текста в системный буфер.
 *
 * Пока плагин ничего не конвертирует, буфер получает только plain-текст.
 * HTML-ветка появится вместе с адаптерами площадок.
 */
export async function writePlainText(text: string): Promise<void> {
	await navigator.clipboard.writeText(text);
}
