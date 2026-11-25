import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse, type ParseOptions } from "../src/core/parse.ts";
import type { Warning } from "../src/core/types.ts";
import { dzenAdapter } from "../src/platforms/dzen.ts";

async function convert(
	markdown: string,
	options: ParseOptions = {}
): Promise<{ html: string; plain: string; warnings: Warning[] }> {
	const doc = parse(markdown, options);
	const warnings = doc.warnings;
	const payload = await dzenAdapter.convert(doc, { warnings });

	return { html: payload.html ?? "", plain: payload.plain, warnings };
}

test("html статьи совпадает с golden прототипа", async () => {
	const markdown = readFileSync(new URL("./fixtures/article.md", import.meta.url), "utf8");
	const expected = readFileSync(new URL("./fixtures/article.dzen.html", import.meta.url), "utf8").replace(
		/\n$/,
		""
	);

	assert.equal((await convert(markdown)).html, expected);
});

test("одиночные блоки совпадают с golden прототипа", async () => {
	const cases: Array<{ markdown: string; html: string }> = JSON.parse(
		readFileSync(new URL("./fixtures/dzen-single.json", import.meta.url), "utf8")
	);

	for (const item of cases) {
		assert.equal((await convert(item.markdown)).html, item.html, item.markdown);
	}
});

test("H2 и H3 остаются заголовками, инлайн-разметка сохраняется", async () => {
	assert.equal(
		(await convert("## Глава\n\n### Раздел")).html,
		"<h2>Глава</h2>\n<h3>Раздел</h3>"
	);
	assert.equal(
		(await convert("Абзац с **жирным** и [ссылкой](https://ya.ru).")).html,
		'<p>Абзац с <b>жирным</b> и <a href="https://ya.ru">ссылкой</a>.</p>'
	);
});

test("код деградирует в цитату и даёт предупреждение", async () => {
	const result = await convert("~~~js\nconst x = 1;\nconst y = 2;\n~~~");

	assert.equal(result.html, "<blockquote><p>const x = 1;<br>const y = 2;</p></blockquote>");
	assert.deepEqual(result.warnings, [
		{ code: "code-degraded", message: "Код в Дзене станет цитатой" }
	]);
	assert.ok(!result.html.includes("<pre"));
	assert.ok(!result.html.includes("<code"));
});

test("код экранирует html и не пропускает tool-строки", async () => {
	const result = await convert("~~~\n<script>alert(1)</script>\n~~~");

	assert.equal(result.html, "<blockquote><p>&lt;script&gt;alert(1)&lt;/script&gt;</p></blockquote>");
	assert.ok(!result.html.includes("[tool:"));
	assert.ok(!result.html.includes("<script>"));
});

test("таблица разворачивается в список пар и даёт предупреждение", async () => {
	const result = await convert("| Колонка | Значение |\n|---|---|\n| A | 1 |\n| B | 2 |");

	assert.equal(
		result.html,
		"<ul>\n<li><b>Колонка:</b> A; <b>Значение:</b> 1</li>\n<li><b>Колонка:</b> B; <b>Значение:</b> 2</li>\n</ul>"
	);
	assert.deepEqual(result.warnings, [
		{ code: "table-degraded", message: "Таблица в Дзене станет списком" }
	]);
	assert.ok(!result.html.includes("<table"));
});

test("картинка с src становится img без предупреждения", async () => {
	const src = "data:image/png;base64,AAAA";
	const result = await convert("![[star.png|64]]", { images: () => ({ src, width: 16 }) });

	assert.equal(result.html, '<img src="' + src + '" alt="star.png" width="64">');
	assert.equal(result.plain, "star.png");
	assert.deepEqual(result.warnings, []);
});

test("без размера в ссылке берётся ширина резолвера", async () => {
	const src = "data:image/png;base64,AAAA";
	const result = await convert("![[star.png]]", { images: () => ({ src, width: 16 }) });

	assert.equal(result.html, '<img src="' + src + '" alt="star.png" width="16">');
});

test("таблица экранирует символы из ячеек", async () => {
	const result = await convert("| A | B |\n|---|---|\n| x & y | <z> |");

	assert.ok(result.html.includes("x &amp; y"));
	assert.ok(result.html.includes("&lt;z&gt;"));
	assert.ok(!result.html.includes("<z>"));
});

test("документ со всеми типами блоков проходит адаптер", async () => {
	const markdown = [
		"## Глава",
		"",
		"Текст",
		"",
		"- Раз",
		"",
		"> Цитата",
		"",
		"~~~js",
		"const x = 1;",
		"~~~",
		"",
		"| A | B |",
		"|---|---|",
		"| 1 | 2 |",
		"",
		"---",
		"",
		"![[star.png|64]]"
	].join("\n");
	const result = await convert(markdown, {
		images: () => ({ src: "data:image/png;base64,AAAA", width: 16 })
	});

	assert.ok(result.html.includes("<h2>Глава</h2>"));
	assert.ok(result.html.includes("<p>Текст</p>"));
	assert.ok(result.html.includes("<ul>\n<li>Раз</li>\n</ul>"));
	assert.ok(result.html.includes("<blockquote><p>Цитата</p></blockquote>"));
	assert.ok(result.html.includes("<blockquote><p>const x = 1;</p></blockquote>"));
	assert.ok(result.html.includes("<ul>\n<li><b>A:</b> 1; <b>B:</b> 2</li>\n</ul>"));
	assert.ok(result.html.includes("<p>* * *</p>"));
	assert.ok(result.html.includes('alt="star.png" width="64"'));
	assert.deepEqual(
		result.warnings.map((warning) => warning.code),
		["code-degraded", "table-degraded"]
	);
});

test("разделитель и пустой вход", async () => {
	assert.equal((await convert("---")).html, "<p>* * *</p>");
	assert.equal((await convert("")).html, "");
});

test("plain это читаемый текст без html-тегов", async () => {
	const markdown = readFileSync(new URL("./fixtures/article.md", import.meta.url), "utf8");
	const result = await convert(markdown);

	assert.ok(!/<(?:p|a|b|i|ul|ol|li|blockquote|img|h2|h3)\b/i.test(result.plain));
	assert.ok(result.plain.includes("Глава"));
	assert.ok(result.plain.includes("Первый пункт"));
	assert.ok(result.plain.includes("Колонка: A"));
});

test("чистый документ не даёт предупреждений", async () => {
	const result = await convert("## Глава\n\nТекст с **жирным**.");

	assert.deepEqual(result.warnings, []);
});
