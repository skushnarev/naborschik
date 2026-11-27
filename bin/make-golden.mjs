import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "../src/core/parse.ts";
import { PLATFORMS } from "../src/platforms/index.ts";

/**
 * Пересобирает golden-фикстуры из `src/`. Запускать после правки
 * `article.md` или осознанного изменения выходов: `make golden`.
 *
 * Источник истины это продакшен-разбор и реестр площадок. Новая площадка
 * в `PLATFORMS` получает фикстуры без правки генератора. Генератор
 * обновляет эталоны, а не проверяет их, поэтому diff перед коммитом
 * обязателен.
 */
const root = process.cwd();
const fixtures = join(root, "test", "fixtures");

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

const article = parse(readFileSync(join(fixtures, "article.md"), "utf8"));
const singles = singleCases.map((markdown) => ({ markdown, doc: parse(markdown) }));
const outputs = [{ file: "article.expected.json", body: JSON.stringify(article, null, 2) + "\n" }];

for (const adapter of PLATFORMS) {
	const articlePayload = await convert(adapter, article);
	const extension = articlePayload.html != null ? "html" : "txt";
	outputs.push({
		file: `article.${adapter.id}.${extension}`,
		body: (articlePayload.html ?? articlePayload.plain) + "\n"
	});

	const cases = [];
	for (const { markdown, doc } of singles) {
		const payload = await convert(adapter, doc);
		cases.push(payload.html != null ? { markdown, html: payload.html } : { markdown, payload: payload.plain });
	}

	outputs.push({ file: `${adapter.id}-single.json`, body: JSON.stringify(cases, null, 2) + "\n" });
}

// Пишем после расчёта всех выходов, чтобы сбой не оставил половину набора.
for (const { file, body } of outputs) writeFileSync(join(fixtures, file), body);

/** Контекст как в веб-версии: свежая копия предупреждений разбора на каждый вызов. */
async function convert(adapter, doc) {
	return adapter.convert(doc, { warnings: [...doc.warnings] });
}
