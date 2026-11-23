import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
globalThis.marked = require(join(here, "..", "vendor", "marked.umd.js")).marked;
const C = require(join(here, "..", "converter.js"));

const dzen = (markdown) => C.toDzenHtml(C.toBlocks(markdown));

test("Дзен: H2 и H3 остаются заголовками", () => {
  assert.equal(dzen("## Глава\n\n### Раздел"), "<h2>Глава</h2>\n<h3>Раздел</h3>");
});

test("Дзен: абзац сохраняет инлайн-разметку", () => {
  assert.equal(
    dzen("Абзац с **жирным** и [ссылкой](https://ya.ru)."),
    '<p>Абзац с <b>жирным</b> и <a href="https://ya.ru">ссылкой</a>.</p>'
  );
});

test("Дзен: список становится ul или ol", () => {
  assert.equal(dzen("- Раз\n- Два"), "<ul>\n<li>Раз</li>\n<li>Два</li>\n</ul>");
  assert.equal(dzen("1. Раз\n2. Два"), "<ol>\n<li>Раз</li>\n<li>Два</li>\n</ol>");
});

test("Дзен: цитата становится blockquote", () => {
  assert.equal(dzen("> Цитата"), "<blockquote><p>Цитата</p></blockquote>");
});

test("Дзен: код деградирует в цитату без pre", () => {
  const html = dzen("~~~js\nconst x = 1;\nconst y = 2;\n~~~");

  assert.equal(html, "<blockquote><p>const x = 1;<br>const y = 2;</p></blockquote>");
  assert.ok(!html.includes("<pre"));
  assert.ok(!html.includes("<code"));
});

test("Дзен: таблица разворачивается в список пар", () => {
  const html = dzen("| Колонка | Значение |\n|---|---|\n| A | 1 |\n| B | 2 |");

  assert.equal(
    html,
    "<ul>\n<li><b>Колонка:</b> A; <b>Значение:</b> 1</li>\n<li><b>Колонка:</b> B; <b>Значение:</b> 2</li>\n</ul>"
  );
  assert.ok(!html.includes("<table"));
});

test("Дзен: разделитель становится текстовой отбивкой", () => {
  assert.equal(dzen("---"), "<p>* * *</p>");
});

test("Дзен: код экранирует html и не пропускает tool-строки", () => {
  const html = dzen("~~~\n<script>alert(1)</script>\n~~~");

  assert.equal(html, "<blockquote><p>&lt;script&gt;alert(1)&lt;/script&gt;</p></blockquote>");
  assert.ok(!html.includes("[tool:"));
  assert.ok(!html.includes("<script>"));
});

test("Дзен: пустой вход даёт пустую строку", () => {
  assert.equal(dzen(""), "");
});
