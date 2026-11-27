import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "../src/core/parse.ts";
import { dzenAdapter } from "../src/platforms/dzen.ts";
import { smartlabAdapter } from "../src/platforms/smartlab.ts";
import { vcruAdapter } from "../src/platforms/vcru.ts";

/**
 * Пересобирает golden-фикстуры из `src/`. Запускать после правки
 * `article.md` или осознанного изменения выходов: `make golden`.
 *
 * Источник истины это продакшен-разбор и адаптеры. Генератор обновляет
 * эталоны, а не проверяет их, поэтому diff перед коммитом обязателен.
 */
const root = process.cwd();
const fixtures = join(root, "test", "fixtures");

const markdown = readFileSync(join(fixtures, "article.md"), "utf8");
const doc = parse(markdown);

async function convert(adapter) {
	return adapter.convert(doc, { warnings: [...doc.warnings] });
}

const vcru = await convert(vcruAdapter);
const dzen = await convert(dzenAdapter);
const smartlab = await convert(smartlabAdapter);

writeFileSync(join(fixtures, "article.expected.json"), JSON.stringify(doc, null, 2) + "\n");
writeFileSync(join(fixtures, "article.vcru.txt"), vcru.plain + "\n");
writeFileSync(join(fixtures, "article.dzen.html"), (dzen.html ?? "") + "\n");
writeFileSync(join(fixtures, "article.smartlab.html"), (smartlab.html ?? "") + "\n");

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

const vcruSingle = [];
const dzenSingle = [];
const smartlabSingle = [];

for (const markdown of singleCases) {
	const document = parse(markdown);
	const vcruPayload = await vcruAdapter.convert(document, { warnings: [...document.warnings] });
	const dzenPayload = await dzenAdapter.convert(document, { warnings: [...document.warnings] });
	const smartlabPayload = await smartlabAdapter.convert(document, { warnings: [...document.warnings] });

	vcruSingle.push({ markdown, payload: vcruPayload.plain });
	dzenSingle.push({ markdown, html: dzenPayload.html ?? "" });
	smartlabSingle.push({ markdown, html: smartlabPayload.html ?? "" });
}

writeFileSync(join(fixtures, "vcru-single.json"), JSON.stringify(vcruSingle, null, 2) + "\n");
writeFileSync(join(fixtures, "dzen-single.json"), JSON.stringify(dzenSingle, null, 2) + "\n");
writeFileSync(join(fixtures, "smartlab-single.json"), JSON.stringify(smartlabSingle, null, 2) + "\n");
