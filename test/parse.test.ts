import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "../src/core/parse.ts";

test("пустой вход даёт пустой документ", () => {
	assert.deepEqual(parse(""), { blocks: [], warnings: [] });
});

test("frontmatter и H1 не попадают в документ", () => {
	const doc = parse("---\ntitle: Статья\ntags: [a]\n---\n# Заголовок\n\nПервый абзац.");

	assert.deepEqual(doc.blocks, [
		{ type: "text", html: "<p>Первый абзац.</p>", text: "Первый абзац." }
	]);
});

test("абзац сохраняет инлайн-разметку и экранирует символы", () => {
	const doc = parse("Абзац с **жирным**, *курсивом*, `кодом` и [ссылкой](https://ya.ru). Символы & < >.");

	assert.deepEqual(doc.blocks, [
		{
			type: "text",
			html: '<p>Абзац с <b>жирным</b>, <i>курсивом</i>, кодом и <a href="https://ya.ru">ссылкой</a>. Символы &amp; &lt; &gt;.</p>',
			text: "Абзац с жирным, курсивом, кодом и ссылкой. Символы & < >."
		}
	]);
});

test("H2 и H3 остаются заголовками, H4-H6 становятся жирным абзацем", () => {
	const doc = parse("## Глава\n\n### Раздел\n\n#### Подраздел\n\n##### Мелкий");

	assert.deepEqual(doc.blocks, [
		{ type: "header", level: 2, text: "Глава" },
		{ type: "header", level: 3, text: "Раздел" },
		{ type: "text", html: "<p><b>Подраздел</b></p>", text: "Подраздел" },
		{ type: "text", html: "<p><b>Мелкий</b></p>", text: "Мелкий" }
	]);
});

test("список становится блоком, вложенность показана маркером", () => {
	const doc = parse("- Раз\n- Два\n  - Вложенный");

	assert.deepEqual(doc.blocks, [
		{
			type: "list",
			ordered: false,
			items: [
				{ html: "Раз", text: "Раз" },
				{ html: "Два", text: "Два" },
				{ html: "↳ Вложенный", text: "↳ Вложенный" }
			]
		}
	]);
});

test("пункты задач сохраняют отметку, нумерация остаётся ordered", () => {
	assert.deepEqual(parse("- [x] Сделано\n- [ ] Нет").blocks, [
		{
			type: "list",
			ordered: false,
			items: [
				{ html: "☑ Сделано", text: "☑ Сделано" },
				{ html: "☐ Нет", text: "☐ Нет" }
			]
		}
	]);

	assert.deepEqual(parse("1. Раз\n2. Два").blocks, [
		{
			type: "list",
			ordered: true,
			items: [
				{ html: "Раз", text: "Раз" },
				{ html: "Два", text: "Два" }
			]
		}
	]);
});

test("цитата становится блоком quote с html и текстом", () => {
	assert.deepEqual(parse("> Цитата с **жирным**").blocks, [
		{ type: "quote", html: "<p>Цитата с <b>жирным</b></p>", text: "Цитата с жирным" }
	]);
});

test("callout превращается в цитату с жирным заголовком", () => {
	assert.deepEqual(parse("> [!note] Важно\n> Текст").blocks, [
		{ type: "quote", html: "<p><b>Важно</b><br>Текст</p>", text: "Важно\nТекст" }
	]);
});

test("код сохраняет текст и нормализует язык", () => {
	assert.deepEqual(parse("~~~js\nconst x = 1;\n~~~").blocks, [
		{ type: "code", text: "const x = 1;", lang: "javascript" }
	]);

	assert.deepEqual(parse("~~~\nplain\n~~~").blocks, [{ type: "code", text: "plain", lang: "" }]);
});

test("разделитель становится блоком delimiter", () => {
	assert.deepEqual(parse("---").blocks, [{ type: "delimiter" }]);
});

test("таблица сохраняет ячейки, выравнивание и исходный текст", () => {
	assert.deepEqual(
		parse("| Колонка | Значение |\n|:---|---:|\n| A | 1 |\n| B | 2 |").blocks,
		[
			{
				type: "table",
				headers: ["Колонка", "Значение"],
				rows: [["A", "1"], ["B", "2"]],
				align: ["left", "right"],
				raw: "| Колонка | Значение |\n|:---|---:|\n| A | 1 |\n| B | 2 |"
			}
		]
	);
});

test("html-блок экранируется и остаётся текстом", () => {
	assert.deepEqual(parse("<div>привет</div>").blocks, [
		{ type: "text", html: "<p>&lt;div&gt;привет&lt;/div&gt;</p>", text: "<div>привет</div>" }
	]);
});

test("вики-ссылки остаются текстом и не разворачиваются", () => {
	assert.deepEqual(parse("Ссылка на [[Папка/Заметка|алиас]] и [[Заметка#Раздел]].").blocks, [
		{
			type: "text",
			html: "<p>Ссылка на [[Папка/Заметка|алиас]] и [[Заметка#Раздел]].</p>",
			text: "Ссылка на [[Папка/Заметка|алиас]] и [[Заметка#Раздел]]."
		}
	]);
});

test("подсветка, комментарии и блочные идентификаторы убираются", () => {
	assert.deepEqual(parse("Текст ==важный==. ^block-1").blocks, [
		{ type: "text", html: "<p>Текст важный.</p>", text: "Текст важный." }
	]);

	assert.deepEqual(parse("До %%скрыто%% после").blocks, [
		{ type: "text", html: "<p>До  после</p>", text: "До  после" }
	]);
});

test("картинка без резолвера остаётся текстом и даёт предупреждение", () => {
	assert.deepEqual(parse("![[star.png|64]]"), {
		blocks: [{ type: "text", html: "<p>![[star.png|64]]</p>", text: "![[star.png|64]]" }],
		warnings: [{ code: "image-unresolved", message: "Картинка не найдена: star.png" }]
	});
});

test("картинка с резолвером становится блоком image", () => {
	const src = "data:image/png;base64,AAAA";
	const doc = parse("![[BLG/star.png|64]]", {
		images: (name) => (name === "BLG/star.png" ? { src, width: 16 } : null)
	});

	assert.deepEqual(doc, {
		blocks: [{ type: "image", src, alt: "star.png", width: 64, raw: "![[BLG/star.png|64]]" }],
		warnings: []
	});
});

test("резолвер без ширины в записи берёт ширину из резолвера", () => {
	const doc = parse("![[star.png]]", {
		images: () => ({ src: "https://example.com/star.png", width: 300 })
	});

	assert.deepEqual(doc.blocks, [
		{ type: "image", src: "https://example.com/star.png", alt: "star.png", width: 300, raw: "![[star.png]]" }
	]);
});

test("резолвер ищет файл по имени без папки", () => {
	const src = "data:image/png;base64,AAAA";
	const doc = parse("![[BLG/star.png]]", {
		images: (name) => (name === "star.png" ? { src, width: null } : null)
	});

	assert.deepEqual(doc.blocks, [
		{ type: "image", src, alt: "star.png", width: null, raw: "![[BLG/star.png]]" }
	]);
});

test("вставка заметки остаётся текстом без предупреждения", () => {
	assert.deepEqual(parse("![[Заметка]]"), {
		blocks: [{ type: "text", html: "<p>![[Заметка]]</p>", text: "![[Заметка]]" }],
		warnings: []
	});
});

test("картинка внутри абзаца остаётся текстом", () => {
	const src = "data:image/png;base64,AAAA";
	const doc = parse("До ![[star.png|64]] после", { images: () => ({ src, width: 16 }) });

	assert.deepEqual(doc.blocks, [
		{ type: "text", html: "<p>До ![[star.png|64]] после</p>", text: "До ![[star.png|64]] после" }
	]);
	assert.deepEqual(doc.warnings, []);
});

test("опасная схема не становится картинкой", () => {
	const doc = parse("![[star.png]]", { images: () => ({ src: "javascript:alert(1)", width: 0 }) });

	assert.equal(doc.blocks[0]?.type, "text");
	assert.deepEqual(doc.warnings, [{ code: "image-unresolved", message: "Картинка не найдена: star.png" }]);
});

test("обычная markdown-картинка остаётся текстом без предупреждения", () => {
	assert.deepEqual(parse("![alt](https://example.com/a.png)"), {
		blocks: [
			{ type: "text", html: "<p>![alt](https://example.com/a.png)</p>", text: "![alt](https://example.com/a.png)" }
		],
		warnings: []
	});
});

test("golden: статья из фикстуры совпадает с прототипом", () => {
	const markdown = readFileSync(new URL("./fixtures/article.md", import.meta.url), "utf8");
	const expected: unknown = JSON.parse(
		readFileSync(new URL("./fixtures/article.expected.json", import.meta.url), "utf8")
	);

	assert.deepEqual(parse(markdown), expected);
});

test("синтаксис Obsidian внутри кода не трогается", () => {
	assert.deepEqual(parse("~~~\n![[star.png]] [[Заметка]] ==x== %%y%%\n~~~"), {
		blocks: [{ type: "code", text: "![[star.png]] [[Заметка]] ==x== %%y%%", lang: "" }],
		warnings: []
	});

	assert.deepEqual(parse("Код `![[star.png]]` и `==x==`."), {
		blocks: [{ type: "text", html: "<p>Код ![[star.png]] и ==x==.</p>", text: "Код ![[star.png]] и ==x==." }],
		warnings: []
	});
});
