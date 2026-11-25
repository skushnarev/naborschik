import { escapeHtml, htmlToText } from "../core/html.ts";
import type { Block, ClipboardPayload, PlatformAdapter } from "../core/types.ts";

/**
 * vc.ru принимает нативные блоки строками `[tool:{...}]`, разделёнными
 * пустой строкой. Одиночный блок уходит читаемым текстом: из одной строки
 * площадка нативный блок не создаёт.
 */
export const vcruAdapter: PlatformAdapter = {
	id: "vcru",
	title: "vc.ru",
	forWhom: "vc.ru",
	icon: "newspaper",
	async convert(doc): Promise<ClipboardPayload> {
		return { plain: toPayload(doc.blocks) };
	}
};

function toPayload(blocks: Block[]): string {
	if (blocks.length === 0) return "";

	const [only] = blocks;
	if (blocks.length === 1 && only) return singleBlockToText(only);

	return blocks.map(serializeBlock).join("\n\n");
}

function serializeBlock(block: Block): string {
	switch (block.type) {
		case "header":
			return "[header:" + JSON.stringify({ text: block.text, style: "h" + block.level }) + "]";
		case "text":
			return "[text:" + JSON.stringify({ text: block.html }) + "]";
		case "list":
			return (
				"[list:" +
				JSON.stringify({
					type: block.ordered ? "OL" : "UL",
					items: block.items.map((item) => item.html)
				}) +
				"]"
			);
		case "quote":
			return "[quote:" + JSON.stringify({ text: block.html, subline1: "" }) + "]";
		case "code":
			return "[code:" + JSON.stringify({ text: block.text, lang: block.lang, lineWrapping: false }) + "]";
		case "table":
			return "[code:" + JSON.stringify({ text: block.raw, lang: "", lineWrapping: false }) + "]";
		case "image":
			// Картинки в MVP не загружаются: строка остаётся текстом для ручной замены.
			return "[text:" + JSON.stringify({ text: escapeHtml(block.raw) }) + "]";
		case "delimiter":
			return "[delimiter:" + JSON.stringify({ type: "default" }) + "]";
	}
}

function singleBlockToText(block: Block): string {
	switch (block.type) {
		case "header":
			return block.text;
		case "text":
			return htmlToText(block.html).trim();
		case "list":
			return block.items
				.map((item) => "- " + htmlToText(item.html).trim())
				.join("\n");
		case "quote":
			return htmlToText(block.html)
				.split("\n")
				.map((line) => (line ? "> " + line : ">"))
				.join("\n")
				.trim();
		case "code":
			return block.text;
		case "table":
			return block.raw;
		case "image":
			return block.raw;
		case "delimiter":
			return "***";
	}
}
