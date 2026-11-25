import { escapeHtml, escapeLines } from "../core/html.ts";
import type { Block, ClipboardPayload, ConvertContext, PlatformAdapter } from "../core/types.ts";
import { renderImage, renderList } from "./html.ts";
import { toPlainText } from "./plain.ts";

/**
 * Дзен принимает HTML. Код деградирует в цитату без `pre`, таблица
 * разворачивается в список пар: визуальный редактор не держит таблицы.
 */
export const dzenAdapter: PlatformAdapter = {
	id: "dzen",
	title: "Дзен",
	forWhom: "Дзена",
	icon: "book-open",
	async convert(doc, ctx): Promise<ClipboardPayload> {
		return {
			html: toDzenHtml(doc.blocks, ctx),
			plain: toPlainText(doc.blocks)
		};
	}
};

function toDzenHtml(blocks: Block[], ctx: ConvertContext): string {
	return blocks
		.map((block) => blockToHtml(block, ctx))
		.filter(Boolean)
		.join("\n");
}

function blockToHtml(block: Block, ctx: ConvertContext): string {
	switch (block.type) {
		case "header":
			return "<h" + block.level + ">" + escapeHtml(block.text) + "</h" + block.level + ">";
		case "text":
			return block.html;
		case "list":
			return renderList(block);
		case "quote":
			return "<blockquote>" + block.html + "</blockquote>";
		case "code":
			ctx.warnings.push({ code: "code-degraded", message: "Код в Дзене станет цитатой" });
			return "<blockquote><p>" + escapeLines(block.text) + "</p></blockquote>";
		case "table":
			ctx.warnings.push({ code: "table-degraded", message: "Таблица в Дзене станет списком" });
			return renderTableAsList(block);
		case "image":
			return renderImage(block);
		case "delimiter":
			return "<p>* * *</p>";
	}
}

function renderTableAsList(block: Extract<Block, { type: "table" }>): string {
	const items: string[] = [];

	for (const row of block.rows) {
		const pairs = block.headers.map((header, index) => {
			const value = row[index] ?? "";
			return "<b>" + header + ":</b>" + (value ? " " + value : "");
		});
		if (pairs.length) items.push("<li>" + pairs.join("; ") + "</li>");
	}

	if (items.length === 0) return "";
	return "<ul>\n" + items.join("\n") + "\n</ul>";
}
