import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "../src/core/parse.ts";
import { PLATFORMS } from "../src/platforms/index.ts";
import { vcruAdapter } from "../src/platforms/vcru.ts";

async function payload(markdown: string): Promise<string> {
	const doc = parse(markdown);
	const result = await vcruAdapter.convert(doc, { warnings: doc.warnings });
	return result.plain;
}

test("реестр площадок начинается с vc.ru", () => {
	assert.deepEqual(
		PLATFORMS.map((platform) => platform.id),
		["vcru"]
	);
});

test("payload статьи совпадает с golden прототипа", async () => {
	const markdown = readFileSync(new URL("./fixtures/article.md", import.meta.url), "utf8");
	const expected = readFileSync(new URL("./fixtures/article.vcru.txt", import.meta.url), "utf8").replace(
		/\n$/,
		""
	);

	assert.equal(await payload(markdown), expected);
});

test("одиночный блок отдаётся читаемым текстом", async () => {
	assert.equal(await payload("## Глава"), "Глава");
	assert.equal(await payload("Текст с **жирным**"), "Текст с жирным");
	assert.equal(await payload("- Раз\n- Два"), "- Раз\n- Два");
	assert.equal(await payload("> Цитата\n> Вторая"), "> Цитата\n> Вторая");
	assert.equal(await payload("~~~\nconst x = 1;\n~~~"), "const x = 1;");
	assert.equal(await payload("| A | B |\n|---|---|\n| 1 | 2 |"), "| A | B |\n|---|---|\n| 1 | 2 |");
	assert.equal(await payload("![[star.png|64]]"), "![[star.png|64]]");
	assert.equal(await payload("---"), "***");
});

test("смешанный документ собирает tool-блоки через пустую строку", async () => {
	const markdown = [
		"## Глава",
		"",
		"Текст с **жирным**.",
		"",
		"- Раз",
		"- Два",
		"",
		"> Цитата",
		"",
		"| A | B |",
		"|---|---|",
		"| 1 | 2 |"
	].join("\n");

	assert.equal(
		await payload(markdown),
		[
			'[header:{"text":"Глава","style":"h2"}]',
			'[text:{"text":"<p>Текст с <b>жирным</b>.</p>"}]',
			'[list:{"type":"UL","items":["Раз","Два"]}]',
			'[quote:{"text":"<p>Цитата</p>","subline1":""}]',
			'[code:{"text":"| A | B |\\n|---|---|\\n| 1 | 2 |","lang":"","lineWrapping":false}]'
		].join("\n\n")
	);
});

test("таблица в смешанном документе уходит code-блоком с пустым языком", async () => {
	const result = await payload("Текст\n\n| A | B |\n|---|---|\n| 1 | 2 |");

	assert.ok(result.includes('[code:{"text":"| A | B |\\n|---|---|\\n| 1 | 2 |","lang":"","lineWrapping":false}]'));
});

test("картинка в смешанном документе остаётся текстом", async () => {
	assert.equal(
		await payload("Текст\n\n![[star.png|64]]"),
		['[text:{"text":"<p>Текст</p>"}]', '[text:{"text":"<p>![[star.png|64]]</p>"}]'].join("\n\n")
	);
});

test("разрешённая картинка уходит текстовой строкой", async () => {
	const src = "data:image/png;base64,AAAA";
	const doc = parse("Текст\n\n![[star.png|64]]", { images: () => ({ src, width: 16 }) });

	assert.equal(
		(await vcruAdapter.convert(doc, { warnings: doc.warnings })).plain,
		['[text:{"text":"<p>Текст</p>"}]', '[text:{"text":"![[star.png|64]]"}]'].join("\n\n")
	);
});

test("пустой документ даёт пустой payload", async () => {
	assert.equal(await payload(""), "");
	assert.equal(await payload("---\ntitle: Статья\n---\n# Заголовок"), "");
});

test("payload не содержит префикса заглушки", async () => {
	const result = await payload("Текст");

	assert.ok(!result.startsWith("Для "));
	assert.equal(result, "Текст");
});
