import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const marked = require(join(here, "..", "vendor", "marked.umd.js")).marked;

globalThis.marked = marked;
const C = require(join(here, "..", "converter.js"));

test("таблица становится отдельным блоком", () => {
  const blocks = C.toBlocks("| Колонка | Значение |\n|:---|---:|\n| A | 1 |\n| B | 2 |");

  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, "table");
  assert.deepEqual(blocks[0].headers, ["Колонка", "Значение"]);
  assert.deepEqual(blocks[0].rows, [["A", "1"], ["B", "2"]]);
  assert.deepEqual(blocks[0].align, ["left", "right"]);
});

test("таблица сохраняет экранированную трубу, ссылку и пустую ячейку", () => {
  const blocks = C.toBlocks("| A | B | C |\n|:---:|---:|---|\n| x \\| y |  | [z](https://ya.ru) |");
  const table = blocks[0];

  assert.equal(table.type, "table");
  assert.equal(table.rows[0][0], "x | y");
  assert.equal(table.rows[0][1], "");
  assert.equal(table.rows[0][2], '<a href="https://ya.ru">z</a>');
  assert.ok(table.raw.includes("x \\| y"));
});

test("vc payload таблицы в смешанном документе остаётся code-блоком", () => {
  const blocks = C.toBlocks("Текст\n\n| A | B |\n|---|---|\n| 1 | 2 |");
  const payload = C.toVcruPayload(blocks);

  assert.ok(payload.includes("[code:"));
  assert.ok(payload.includes('"lang":""'));
  assert.ok(payload.includes('"text":"| A | B |\\n|---|---|\\n| 1 | 2 |"'));
});

test("одиночная таблица уходит читаемым текстом", () => {
  const blocks = C.toBlocks("| A | B |\n|---|---|\n| 1 | 2 |");

  assert.equal(C.toVcruPayload(blocks), "| A | B |\n|---|---|\n| 1 | 2 |");
});

test("обычный код остаётся code-блоком", () => {
  const blocks = C.toBlocks("~~~js\nconst x = 1;\n~~~");

  assert.equal(blocks[0].type, "code");
  assert.equal(blocks[0].lang, "javascript");
  assert.equal(blocks[0].text, "const x = 1;");
});
