import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

/**
 * Пересобирает `test/fixtures/article.expected.json` из проверенного
 * прототипа. Запускать после правки `article.md`: `make golden`.
 *
 * Прототип отдаёт блоки с полями vc.ru, поэтому здесь они переводятся
 * в нейтральную модель `Document`. HTML, списки, таблицы и код берутся
 * из прототипа без изменений, это и есть golden.
 */
const require = createRequire(import.meta.url);
const root = process.cwd();
globalThis.marked = require(join(root, "prototype", "vendor", "marked.umd.js")).marked;
const C = require(join(root, "prototype", "converter.js"));

const markdown = readFileSync(join(root, "test", "fixtures", "article.md"), "utf8");
const blocks = C.toBlocks(markdown);

function text(html) {
	return C.htmlToText(html).trim();
}

const neutral = blocks.map((block) => {
	switch (block.type) {
		case "header":
			return { type: "header", level: Number(block.style.slice(1)), text: block.text };
		case "text":
			return { type: "text", html: block.html, text: text(block.html) };
		case "list":
			return {
				type: "list",
				ordered: block.listType === "OL",
				items: block.items.map((html) => ({ html, text: text(html) }))
			};
		case "quote":
			return { type: "quote", html: block.html, text: text(block.html) };
		case "code":
			return { type: "code", text: block.text, lang: block.lang };
		case "table":
			return { type: "table", headers: block.headers, rows: block.rows, align: block.align, raw: block.raw };
		case "delimiter":
			return { type: "delimiter" };
		default:
			throw new Error("неожиданный блок: " + block.type);
	}
});

const warnings = [...markdown.matchAll(/!\[\[([^\]]*)\]\]/g)]
	.filter((match) => /\.(png|jpe?g|gif|webp|svg|avif|bmp)(\||\]\]|$)/i.test(match[1] ?? ""))
	.map((match) => {
		const target = (match[1] ?? "").split("|")[0]?.trim() ?? "";
		return { code: "image-unresolved", message: "Картинка не найдена: " + target };
	});

writeFileSync(
	join(root, "test", "fixtures", "article.expected.json"),
	JSON.stringify({ blocks: neutral, warnings }, null, 2) + "\n"
);

writeFileSync(join(root, "test", "fixtures", "article.vcru.txt"), C.toVcruPayload(blocks) + "\n");
writeFileSync(join(root, "test", "fixtures", "article.dzen.html"), C.toDzenHtml(blocks) + "\n");

const singleCases = [
	"## Глава",
	"Текст с **жирным**",
	"- Раз\n- Два",
	"1. Раз\n2. Два",
	"> Цитата\n> Вторая",
	"> [!note] Важно\n> Текст",
	"~~~\nconst x = 1;\n~~~",
	"| A | B |\n|---|---|\n| 1 | 2 |",
	"![[star.png|64]]",
	"---"
];

writeFileSync(
	join(root, "test", "fixtures", "vcru-single.json"),
	JSON.stringify(
		singleCases.map((markdown) => ({
			markdown,
			payload: C.toVcruPayload(C.toBlocks(markdown))
		})),
		null,
		2
	) + "\n"
);

writeFileSync(
	join(root, "test", "fixtures", "dzen-single.json"),
	JSON.stringify(
		singleCases.map((markdown) => ({
			markdown,
			html: C.toDzenHtml(C.toBlocks(markdown))
		})),
		null,
		2
	) + "\n"
);
