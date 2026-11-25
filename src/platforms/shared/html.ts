import { escapeAttr } from "../../core/html.ts";
import type { Block } from "../../core/types.ts";

export function renderList(block: Extract<Block, { type: "list" }>): string {
	const tag = block.ordered ? "ol" : "ul";
	if (block.items.length === 0) return "";

	return "<" + tag + ">\n" + block.items.map((item) => "<li>" + item.html + "</li>").join("\n") + "\n</" + tag + ">";
}

export function renderImage(block: Extract<Block, { type: "image" }>): string {
	let attrs = ' src="' + escapeAttr(block.src) + '" alt="' + escapeAttr(block.alt) + '"';
	if (block.width) attrs += ' width="' + Number(block.width) + '"';

	return "<img" + attrs + ">";
}
