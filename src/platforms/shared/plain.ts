import { htmlToText } from "../../core/html.ts";
import type { Block } from "../../core/types.ts";

/**
 * Читаемый запасной текст для площадок, которые получают HTML.
 * Без тегов, чтобы вставка в текстовое поле не показывала разметку.
 */
export function toPlainText(blocks: Block[]): string {
	return blocks.map(blockToPlain).filter(Boolean).join("\n\n");
}

function blockToPlain(block: Block): string {
	switch (block.type) {
		case "header":
			return block.text;
		case "text":
			return block.text;
		case "list":
			return block.items
				.map((item, index) => (block.ordered ? index + 1 + ". " : "- ") + item.text)
				.join("\n");
		case "quote":
			return block.text;
		case "code":
			return block.text;
		case "table":
			return tableToPlain(block);
		case "image":
			return block.alt || block.raw;
		case "delimiter":
			return "* * *";
	}
}

function tableToPlain(block: Extract<Block, { type: "table" }>): string {
	return block.rows
		.map((row) =>
			row
				.map((cell, index) => {
					const header = htmlToText(block.headers[index] ?? "").trim();
					const value = htmlToText(cell).trim();
					if (!header) return value;
					return header + ":" + (value ? " " + value : "");
				})
				.join("; ")
		)
		.join("\n");
}
