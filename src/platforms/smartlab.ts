import { escapeHtml } from "../core/html.ts";
import type { Block, ClipboardPayload, PlatformAdapter } from "../core/types.ts";
import { renderImage, renderList } from "./shared/html.ts";
import { toPlainText } from "./shared/plain.ts";

/**
 * Смартлаб принимает безопасный HTML. H2 вырезается редактором, поэтому
 * H2 уходит как h3, а H3 как h4. Код в `pre` без вложенного `code`:
 * иначе редактор показывает теги текстом. Без классов, id и стилей.
 */
export const smartlabAdapter: PlatformAdapter = {
	id: "smartlab",
	title: "Смартлаб",
	forWhom: "Смартлаба",
	icon: "trending-up",
	async convert(doc): Promise<ClipboardPayload> {
		return {
			html: toSmartlabHtml(doc.blocks),
			plain: toPlainText(doc.blocks)
		};
	}
};

const HEADING_TAGS: Record<2 | 3, string> = { 2: "h3", 3: "h4" };

function toSmartlabHtml(blocks: Block[]): string {
	return blocks
		.map(blockToHtml)
		.filter(Boolean)
		.join("\n");
}

function blockToHtml(block: Block): string {
	switch (block.type) {
		case "header": {
			const tag = HEADING_TAGS[block.level];
			return "<" + tag + ">" + escapeHtml(block.text) + "</" + tag + ">";
		}
		case "text":
			return block.html;
		case "list":
			return renderList(block);
		case "quote":
			return "<blockquote>" + block.html + "</blockquote>";
		case "code":
			return "<pre>" + escapeHtml(block.text) + "</pre>";
		case "table":
			return renderTable(block);
		case "image":
			return renderImage(block);
		case "delimiter":
			return "<hr>";
	}
}

function renderTable(block: Extract<Block, { type: "table" }>): string {
	if (block.headers.length === 0 && block.rows.length === 0) return "";

	const head = "<tr>" + block.headers.map((header) => "<th>" + header + "</th>").join("") + "</tr>";
	const parts = ["<table>", "<thead>", head, "</thead>"];

	if (block.rows.length > 0) {
		const body = block.rows
			.map((row) => "<tr>" + row.map((cell) => "<td>" + cell + "</td>").join("") + "</tr>")
			.join("\n");
		parts.push("<tbody>", body, "</tbody>");
	}

	parts.push("</table>");
	return parts.join("\n");
}
