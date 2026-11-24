import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
globalThis.marked = require(join(here, "..", "vendor", "marked.umd.js")).marked;
const C = require(join(here, "..", "converter.js"));

const PNG = "data:image/png;base64,AAAA";
const options = { images: { "star.png": PNG } };

test("картинка из карты становится блоком image", () => {
  const blocks = C.toBlocks("![[star.png|64]]", options);

  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, "image");
  assert.equal(blocks[0].src, PNG);
  assert.equal(blocks[0].alt, "star.png");
  assert.equal(blocks[0].width, 64);
  assert.equal(blocks[0].raw, "![[star.png|64]]");
});

test("картинка ищется по имени без папки", () => {
  const blocks = C.toBlocks("![[BLG/star.png]]", options);

  assert.equal(blocks[0].type, "image");
  assert.equal(blocks[0].width, null);
});

test("без карты картинка остаётся текстом", () => {
  const blocks = C.toBlocks("![[star.png|64]]");

  assert.equal(blocks[0].type, "text");
  assert.ok(blocks[0].html.includes("![[star.png|64]]"));
});

test("vc.ru получает прежний текст картинки", () => {
  const single = C.toVcruPayload(C.toBlocks("![[star.png|64]]", options));
  const mixed = C.toVcruPayload(C.toBlocks("Текст\n\n![[star.png|64]]", options));

  assert.equal(single, "![[star.png|64]]");
  assert.ok(mixed.includes('[text:{"text":"<p>![[star.png|64]]</p>"}]'));
});

test("Дзен и Смартлаб получают img с data URI", () => {
  const blocks = C.toBlocks("![[star.png|64]]", options);
  const expected = '<img src="' + PNG + '" alt="star.png" width="64">';

  assert.equal(C.toDzenHtml(blocks), expected);
  assert.equal(C.toSmartlabHtml(blocks), expected);
});

test("опасная схема не превращается в img", () => {
  const blocks = C.toBlocks("![[star.png]]", { images: { "star.png": "javascript:alert(1)" } });

  assert.equal(blocks[0].type, "text");
  assert.ok(blocks[0].html.includes("![[star.png]]"));
});

test("картинка внутри абзаца остаётся текстом", () => {
  const blocks = C.toBlocks("До ![[star.png|64]] после", options);

  assert.equal(blocks[0].type, "text");
  assert.ok(blocks[0].html.includes("![[star.png|64]]"));
  assert.ok(!blocks[0].html.includes("<img"));
});
