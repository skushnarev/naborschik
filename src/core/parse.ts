import { lexer, type Token, type Tokens } from "marked";
import { escapeAttr, escapeHtml, escapeLines, htmlToText } from "./html.ts";
import { normalizeLang } from "./lang.ts";
import type { Block, Document, ImageResolver, ListItem, Warning } from "./types.ts";

export type ParseOptions = {
	images?: ImageResolver;
};

type ResolvedImage = {
	raw: string;
	src: string;
	alt: string;
	width: number | null;
};

type ParseState = {
	images?: ImageResolver;
	warnings: Warning[];
	placeholders: string[];
	imageTokens: ResolvedImage[];
};

/**
 * Markdown в документ: блоки и предупреждения.
 *
 * Чистая функция: ни Obsidian, ни DOM. Картинки становятся блоками только
 * при наличии резолвера, иначе остаются текстом с предупреждением.
 */
export function parse(markdown: string, options: ParseOptions = {}): Document {
	const state: ParseState = {
		images: options.images,
		warnings: [],
		placeholders: [],
		imageTokens: []
	};
	const source = preprocess(markdown, state);
	const tokens = lexer(source, { gfm: true }) as Token[];
	const blocks: Block[] = [];

	for (const token of tokens) {
		switch (token.type) {
			case "heading": {
				const heading = token as Tokens.Heading;
				if (heading.depth === 1) break;

				const text = inlineToPlain(heading.tokens, state);
				if (!text) break;

				if (heading.depth === 2 || heading.depth === 3) {
					blocks.push({ type: "header", level: heading.depth, text });
				} else {
					blocks.push({ type: "text", html: "<p><b>" + escapeHtml(text) + "</b></p>", text });
				}
				break;
			}

			case "paragraph": {
				const paragraph = token as Tokens.Paragraph;
				const image = imageFromParagraph(paragraph.tokens, state);
				if (image) {
					blocks.push({ type: "image", src: image.src, alt: image.alt, width: image.width, raw: image.raw });
					break;
				}

				const html = renderInline(paragraph.tokens, state).trim();
				const text = htmlToText(html).trim();
				if (text) blocks.push({ type: "text", html: "<p>" + html + "</p>", text });
				break;
			}

			case "list": {
				const items = flattenList(token as Tokens.List, state);
				if (items.length) {
					blocks.push({ type: "list", ordered: (token as Tokens.List).ordered, items });
				}
				break;
			}

			case "blockquote": {
				const html = quoteToHtml(token as Tokens.Blockquote, state);
				if (html) blocks.push({ type: "quote", html: "<p>" + html + "</p>", text: htmlToText(html).trim() });
				break;
			}

			case "hr":
				blocks.push({ type: "delimiter" });
				break;

			case "code": {
				const code = token as Tokens.Code;
				const text = code.text.replace(/\n$/, "");
				if (text.trim()) {
					blocks.push({ type: "code", text, lang: normalizeLang(code.lang) });
				}
				break;
			}

			case "table": {
				const table = tableToBlock(token as Tokens.Table, state);
				if (table.raw.trim()) blocks.push(table);
				break;
			}

			case "html": {
				const html = token as Tokens.HTML;
				const raw = html.text ?? html.raw;
				const escaped = escapeLines(raw).trim();
				const text = htmlToText(escaped).trim();
				if (text) blocks.push({ type: "text", html: "<p>" + escaped + "</p>", text });
				break;
			}

			default:
				break;
		}
	}

	return { blocks, warnings: state.warnings };
}

function preprocess(markdown: string, state: ParseState): string {
	let source = String(markdown).replace(/\r\n?/g, "\n");

	// Frontmatter вырезается только в начале документа и только если внутри
	// есть хотя бы один ключ. Иначе первый --- это обычный разделитель.
	const frontmatter = source.match(/^\uFEFF?---\n([\s\S]*?)\n---[ \t]*(?:\n|$)/);
	if (frontmatter && /^[\w-]+\s*:/m.test(frontmatter[1] ?? "")) {
		source = source.slice(frontmatter[0].length);
	}

	// Код защищаем от предобработки: внутри него синтаксис Obsidian это текст.
	const code = protectCode(source);
	source = code.source;

	// Комментарии Obsidian, включая многострочные.
	source = source.replace(/%%[\s\S]*?%%/g, "");

	// Вставки и вики-ссылки остаются текстом как есть: замена ручная,
	// а по [[ пользователь найдёт их поиском, как и картинки.
	source = source.replace(/!\[\[[^\]]*\]\]/g, (match) => {
		const image = resolveImage(match, state);
		return image ? imagePlaceholder(image, state) : textPlaceholder(match, state);
	});

	source = source.replace(/\[\[[^\[\]]+\]\]/g, (match) => textPlaceholder(match, state));

	// Подсветка: разметку убираем, текст оставляем.
	source = source.replace(/==([^=\n]+)==/g, "$1");

	// Callout: маркер убираем, заголовок делаем жирным.
	source = source
		.split("\n")
		.map((line) => {
			const match = line.match(/^(\s*(?:>\s*)+)\[!([A-Za-z0-9_-]+)\][+-]?[ \t]*(.*)$/);
			if (!match) return line;
			const prefix = match[1] ?? "";
			const title = (match[3] ?? "").trim();
			return title ? prefix + "**" + title + "**" : null;
		})
		.filter((line): line is string => line !== null)
		.join("\n");

	// Блочные идентификаторы Obsidian.
	source = source.replace(/[ \t]+\^[A-Za-z0-9-]+[ \t]*$/gm, "");

	return code.restore(source);
}

type ProtectedCode = {
	source: string;
	restore: (value: string) => string;
};

function protectCode(source: string): ProtectedCode {
	const saved: string[] = [];
	const lines = source.split("\n");
	const out: string[] = [];
	let fence: { marker: string; index: number } | null = null;

	for (const line of lines) {
		const match = line.match(/^\s*(`{3,}|~{3,})/);

		if (fence) {
			saved[fence.index] = (saved[fence.index] ?? "") + "\n" + line;
			const closing = match?.[1];
			if (closing && closing.startsWith(fence.marker[0] ?? "") && closing.length >= fence.marker.length) {
				fence = null;
			}
			continue;
		}

		if (match?.[1]) {
			const index = saved.length;
			saved.push(line);
			out.push("@@NABORSCHIK_CODE_" + index + "@@");
			fence = { marker: match[1], index };
			continue;
		}

		out.push(line);
	}

	// Незакрытый забор возвращаем на место: lexer сам решит, код это или текст.
	if (fence) {
		const placeholder = "@@NABORSCHIK_CODE_" + fence.index + "@@";
		const position = out.indexOf(placeholder);
		if (position >= 0) out[position] = saved[fence.index] ?? "";
	}

	// Инлайн-код тоже не должен попадать под замены.
	const text = out.join("\n").replace(/`[^`\n]*`/g, (span) => {
		const index = saved.length;
		saved.push(span);
		return "@@NABORSCHIK_CODE_" + index + "@@";
	});

	return {
		source: text,
		restore: (value) =>
			value.replace(/@@NABORSCHIK_CODE_(\d+)@@/g, (_, index: string) => saved[Number(index)] ?? "")
	};
}

function resolveImage(match: string, state: ParseState): ResolvedImage | null {
	const inner = match.replace(/^!\[\[/, "").replace(/\]\]$/, "");
	const parts = inner.split("|");
	const target = (parts.shift() ?? "").trim();
	if (!target) return null;

	let width: number | null = null;
	for (const part of parts) {
		const value = part.trim();
		if (/^\d+$/.test(value)) width = Number(value);
	}

	const name = target.split("/").pop() || target;
	const looksLikeImage = /\.(png|jpe?g|gif|webp|svg|avif|bmp)$/i.test(name);
	const resolved = state.images?.(target) ?? state.images?.(name) ?? null;
	const src = resolved?.src;

	if (src && /^(data:image\/|https?:\/\/)/i.test(src)) {
		return { raw: match, src, alt: name, width: width ?? resolved?.width ?? null };
	}

	// Вставка заметки это не картинка: без резолвера её не отличить от фото,
	// поэтому предупреждаем только о том, что выглядит как файл изображения.
	if (looksLikeImage) {
		state.warnings.push({ code: "image-unresolved", message: "Картинка не найдена: " + target });
	}

	return null;
}

function textPlaceholder(value: string, state: ParseState): string {
	const index = state.placeholders.length;
	state.placeholders.push(value);
	return "@@NABORSCHIK_" + index + "@@";
}

function imagePlaceholder(image: ResolvedImage, state: ParseState): string {
	const index = state.imageTokens.length;
	state.imageTokens.push(image);
	return "@@NABORSCHIK_IMG_" + index + "@@";
}

function imageFromParagraph(tokens: Token[] | undefined, state: ParseState): ResolvedImage | null {
	if (!tokens || tokens.length !== 1) return null;

	const only = tokens[0];
	if (!only || only.type !== "text") return null;

	const text = only as Tokens.Text;
	return imageFromPlaceholder(text.text, state) ?? imageFromPlaceholder(text.raw, state);
}

function imageFromPlaceholder(text: string, state: ParseState): ResolvedImage | null {
	const match = String(text || "").trim().match(/^@@NABORSCHIK_IMG_(\d+)@@$/);
	if (!match) return null;
	return state.imageTokens[Number(match[1])] ?? null;
}

function restorePlaceholders(html: string, state: ParseState): string {
	return html
		.replace(/@@NABORSCHIK_IMG_(\d+)@@/g, (_, index: string) => {
			const image = state.imageTokens[Number(index)];
			return image ? escapeHtml(image.raw) : "";
		})
		.replace(/@@NABORSCHIK_(\d+)@@/g, (_, index: string) => {
			const value = state.placeholders[Number(index)];
			return value === undefined ? "" : escapeHtml(value);
		});
}

function renderInlineToken(token: Token, state: ParseState): string {
	switch (token.type) {
		case "text": {
			const text = token as Tokens.Text;
			return text.escaped ? text.text.replace(/\n/g, "<br>") : escapeLines(text.text);
		}
		case "escape":
			return escapeHtml((token as Tokens.Escape).text);
		case "strong":
			return "<b>" + renderInline((token as Tokens.Strong).tokens, state) + "</b>";
		case "em":
			return "<i>" + renderInline((token as Tokens.Em).tokens, state) + "</i>";
		case "del":
			return renderInline((token as Tokens.Del).tokens, state);
		case "link": {
			const link = token as Tokens.Link;
			const label = renderInline(link.tokens, state);
			const href = link.href || "";
			if (!/^(https?:\/\/|mailto:|\/|#)/i.test(href)) return label;
			return '<a href="' + escapeAttr(href) + '">' + label + "</a>";
		}
		case "image":
			return escapeHtml((token as Tokens.Image).raw);
		case "codespan":
			return escapeHtml((token as Tokens.Codespan).text);
		case "br":
			return "<br>";
		case "html":
			return escapeHtml((token as Tokens.HTML).raw || (token as Tokens.HTML).text || "");
		case "checkbox":
			return "";
		default: {
			const generic = token as Tokens.Generic;
			if (generic.tokens) return renderInline(generic.tokens, state);
			const value = generic.text != null ? generic.text : generic.raw || "";
			return escapeHtml(String(value));
		}
	}
}

function renderInline(tokens: Token[] | undefined, state: ParseState): string {
	const html = (tokens ?? []).map((token) => renderInlineToken(token, state)).join("");
	return restorePlaceholders(html, state);
}

function inlineToPlain(tokens: Token[] | undefined, state: ParseState): string {
	return htmlToText(renderInline(tokens, state)).trim();
}

function flattenList(token: Tokens.List, state: ParseState, level = 0): ListItem[] {
	const items: ListItem[] = [];

	for (const item of token.items) {
		const parts: string[] = [];
		const nested: Tokens.List[] = [];

		for (const child of item.tokens) {
			if (child.type === "list") {
				nested.push(child as Tokens.List);
			} else if (child.type === "space" || child.type === "checkbox") {
				continue;
			} else if ("tokens" in child && child.tokens) {
				parts.push(renderInline(child.tokens, state));
			} else if ("text" in child && child.text != null) {
				parts.push(escapeLines(String(child.text)));
			}
		}

		const prefix = item.task ? (item.checked ? "☑ " : "☐ ") : "";
		const html = parts.join("<br>").trim();
		if (html) {
			// vc.ru срезает ведущие пробелы и &nbsp; в пунктах списка,
			// поэтому вложенность показываем видимым маркером.
			const indent = level > 0 ? "↳ ".repeat(level) : "";
			const itemHtml = indent + prefix + html;
			items.push({ html: itemHtml, text: htmlToText(itemHtml).trim() });
		}

		for (const child of nested) {
			items.push(...flattenList(child, state, level + 1));
		}
	}

	return items;
}

function quoteToHtml(token: Tokens.Blockquote, state: ParseState): string {
	const parts: string[] = [];

	for (const child of token.tokens) {
		if (child.type === "paragraph") {
			parts.push(renderInline((child as Tokens.Paragraph).tokens, state).trim());
		} else if (child.type === "text") {
			parts.push(escapeLines((child as Tokens.Text).text).trim());
		} else if (child.type === "list") {
			parts.push(flattenList(child as Tokens.List, state).map((item) => item.html).join("<br>"));
		}
	}

	return parts.filter(Boolean).join("<br><br>");
}

function cellToHtml(cell: Tokens.TableCell, state: ParseState): string {
	if (cell.tokens && cell.tokens.length) return renderInline(cell.tokens, state).trim();
	return escapeHtml(cell.text ?? "").trim();
}

function tableToBlock(token: Tokens.Table, state: ParseState): Extract<Block, { type: "table" }> {
	const headers = token.header.map((cell) => cellToHtml(cell, state));
	const rows = token.rows.map((row) => row.map((cell) => cellToHtml(cell, state)));
	const align = (token.align ?? headers.map(() => null)).slice();

	return {
		type: "table",
		headers,
		rows,
		align,
		raw: String(token.raw ?? "").replace(/\n+$/, "")
	};
}
