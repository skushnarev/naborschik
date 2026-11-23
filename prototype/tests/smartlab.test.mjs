import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
globalThis.marked = require(join(here, "..", "vendor", "marked.umd.js")).marked;
const C = require(join(here, "..", "converter.js"));

const smartlab = (markdown) => C.toSmartlabHtml(C.toBlocks(markdown));

test("Смартлаб: H2 и H3 остаются заголовками", () => {
  assert.equal(smartlab("## Глава\n\n### Раздел"), "<h2>Глава</h2>\n<h3>Раздел</h3>");
});

test("Смартлаб: абзац сохраняет инлайн-разметку", () => {
  assert.equal(
    smartlab("Абзац с **жирным** и [ссылкой](https://ya.ru)."),
    '<p>Абзац с <b>жирным</b> и <a href="https://ya.ru">ссылкой</a>.</p>'
  );
});

test("Смартлаб: список становится ul или ol", () => {
  assert.equal(smartlab("- Раз\n- Два"), "<ul>\n<li>Раз</li>\n<li>Два</li>\n</ul>");
  assert.equal(smartlab("1. Раз\n2. Два"), "<ol>\n<li>Раз</li>\n<li>Два</li>\n</ol>");
});

test("Смартлаб: цитата становится blockquote", () => {
  assert.equal(smartlab("> Цитата"), "<blockquote><p>Цитата</p></blockquote>");
});

test("Смартлаб: код становится pre без вложенного code", () => {
  const html = smartlab("~~~js\nconst x = 1;\nconst y = 2;\n~~~");

  assert.equal(html, "<pre>const x = 1;\nconst y = 2;</pre>");
  assert.ok(!html.includes("<code>"));
  assert.ok(!html.includes("</code>"));
});

test("Смартлаб: таблица становится table", () => {
  assert.equal(
    smartlab("| Колонка | Значение |\n|---|---|\n| A | 1 |\n| B | 2 |"),
    "<table>\n<thead>\n<tr><th>Колонка</th><th>Значение</th></tr>\n</thead>\n<tbody>\n<tr><td>A</td><td>1</td></tr>\n<tr><td>B</td><td>2</td></tr>\n</tbody>\n</table>"
  );
});

test("Смартлаб: разделитель становится hr", () => {
  assert.equal(smartlab("---"), "<hr>");
});

test("Смартлаб: код экранирует html", () => {
  const html = smartlab("~~~\n<script>alert(1)</script>\n~~~");

  assert.equal(html, "<pre>&lt;script&gt;alert(1)&lt;/script&gt;</pre>");
  assert.ok(!html.includes("<script>"));
});

test("Смартлаб: в выходе нет классов, id и стилей", () => {
  const html = smartlab("## Глава\n\nАбзац\n\n- Пункт\n\n| A | B |\n|---|---|\n| 1 | 2 |");

  assert.ok(!/\sclass=/.test(html));
  assert.ok(!/\sid=/.test(html));
  assert.ok(!/\sstyle=/.test(html));
});

test("Смартлаб: пустой вход даёт пустую строку", () => {
  assert.equal(smartlab(""), "");
});
