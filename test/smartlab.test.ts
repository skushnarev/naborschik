import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse, type ParseOptions } from "../src/core/parse.ts";
import type { Warning } from "../src/core/types.ts";
import { smartlabAdapter } from "../src/platforms/smartlab.ts";

async function convert(
	markdown: string,
	options: ParseOptions = {}
): Promise<{ html: string; plain: string; warnings: Warning[] }> {
	const doc = parse(markdown, options);
	const warnings = doc.warnings;
	const payload = await smartlabAdapter.convert(doc, { warnings });

	return { html: payload.html ?? "", plain: payload.plain, warnings };
}

test("html статьи совпадает с golden прототипа", async () => {
	const markdown = readFileSync(new URL("./fixtures/article.md", import.meta.url), "utf8");
	const expected = readFileSync(
		new URL("./fixtures/article.smartlab.html", import.meta.url),
		"utf8"
	).replace(/\n$/, "");

	assert.equal((await convert(markdown)).html, expected);
});

test("одиночные блоки совпадают с golden прототипа", async () => {
	const cases: Array<{ markdown: string; html: string }> = JSON.parse(
		readFileSync(new URL("./fixtures/smartlab-single.json", import.meta.url), "utf8")
	);

	for (const item of cases) {
		assert.equal((await convert(item.markdown)).html, item.html, item.markdown);
	}
});

test("H2 и H3 сдвигаются в h3 и h4 без каскада", async () => {
	const result = await convert("## Глава\n\n### Раздел");

	assert.equal(result.html, "<h3>Глава</h3>\n<h4>Раздел</h4>");
	assert.ok(!result.html.includes("<h2>"));
	assert.ok(!result.html.includes("<h5>"));
});

test("абзац сохраняет инлайн-разметку", async () => {
	assert.equal(
		(await convert("Абзац с **жирным** и [ссылкой](https://ya.ru).")).html,
		'<p>Абзац с <b>жирным</b> и <a href="https://ya.ru">ссылкой</a>.</p>'
	);
});

test("код уходит в pre без code и без предупреждения", async () => {
	const result = await convert("~~~js\nconst x = 1;\nconst y = 2;\n~~~");

	assert.equal(result.html, "<pre>const x = 1;\nconst y = 2;</pre>");
	assert.ok(!result.html.includes("<code"));
	assert.deepEqual(result.warnings, []);
});

test("код экранирует html и не пропускает tool-строки", async () => {
	const result = await convert("~~~\n<script>alert(1)</script>\n~~~");

	assert.equal(result.html, "<pre>&lt;script&gt;alert(1)&lt;/script&gt;</pre>");
	assert.ok(!result.html.includes("<script>"));
	assert.ok(!result.html.includes("[tool:"));
});

test("таблица уходит table с thead и tbody без предупреждения", async () => {
	const result = await convert("| Колонка | Значение |\n|---|---|\n| A | 1 |\n| B | 2 |");

	assert.equal(
		result.html,
		"<table>\n<thead>\n<tr><th>Колонка</th><th>Значение</th></tr>\n</thead>\n<tbody>\n<tr><td>A</td><td>1</td></tr>\n<tr><td>B</td><td>2</td></tr>\n</tbody>\n</table>"
	);
	assert.deepEqual(result.warnings, []);
});

test("таблица экранирует символы из ячеек", async () => {
	const result = await convert("| A | B |\n|---|---|\n| x & y | <z> |");

	assert.ok(result.html.includes("x &amp; y"));
	assert.ok(result.html.includes("&lt;z&gt;"));
	assert.ok(!result.html.includes("<z>"));
});

test("разделитель становится hr", async () => {
	assert.equal((await convert("---")).html, "<hr>");
	assert.equal((await convert("")).html, "");
});

test("в выходе нет классов, id и стилей", async () => {
	const result = await convert("## Глава\n\nАбзац\n\n- Пункт\n\n| A | B |\n|---|---|\n| 1 | 2 |");

	assert.ok(!/\sclass=/.test(result.html));
	assert.ok(!/\sid=/.test(result.html));
	assert.ok(!/\sstyle=/.test(result.html));
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

	assert.ok(result.html.includes("<h3>Глава</h3>"));
	assert.ok(result.html.includes("<p>Текст</p>"));
	assert.ok(result.html.includes("<ul>\n<li>Раз</li>\n</ul>"));
	assert.ok(result.html.includes("<blockquote><p>Цитата</p></blockquote>"));
	assert.ok(result.html.includes("<pre>const x = 1;</pre>"));
	assert.ok(result.html.includes("<table>\n<thead>\n<tr><th>A</th><th>B</th></tr>"));
	assert.ok(result.html.includes("<hr>"));
	assert.ok(result.html.includes('alt="star.png" width="64"'));
});

test("plain это читаемый текст без html-тегов", async () => {
	const markdown = readFileSync(new URL("./fixtures/article.md", import.meta.url), "utf8");
	const result = await convert(markdown);

	assert.ok(
		!/<(?:p|a|b|i|ul|ol|li|blockquote|img|h3|h4|pre|table|hr|thead|tbody|tr|th|td)\b/i.test(
			result.plain
		)
	);
	assert.ok(result.plain.includes("Глава"));
	assert.ok(result.plain.includes("Первый пункт"));
	assert.ok(result.plain.includes("Колонка: A"));
});
