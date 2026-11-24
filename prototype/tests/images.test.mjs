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

const MEDIA = {
  uuid: "d5b9fb1f-6c25-5923-a2d6-838d62c9503e",
  width: 16,
  height: 16,
  size: 106,
  type: "png",
  color: "e64626",
  preview: "/9j/4AAQSkZJRgABAQIA"
};
const mediaOptions = { images: { "star.png": { src: PNG, media: MEDIA } } };

function parseMediaLine(payload) {
  const line = payload.split("\n\n").find((part) => part.startsWith("[media:"));
  assert.ok(line, "в payload нет media-блока");
  return JSON.parse(line.slice("[media:".length, -1));
}

test("карта принимает объект с media", () => {
  const blocks = C.toBlocks("![[star.png|64]]", mediaOptions);

  assert.equal(blocks[0].type, "image");
  assert.equal(blocks[0].src, PNG);
  assert.equal(blocks[0].width, 64);
  assert.deepEqual(blocks[0].media, MEDIA);
});

test("объект с media.uuid даёт vc.ru блок media", () => {
  const payload = C.toVcruPayload(C.toBlocks("Текст\n\n![[star.png|64]]", mediaOptions));
  const data = parseMediaLine(payload);

  assert.equal(data.title, null);
  assert.equal(data.items.length, 1);
  assert.equal(data.items[0].title, "star.png");
  assert.equal(data.items[0].image.type, "image");
  assert.deepEqual(data.items[0].image.data, {
    uuid: MEDIA.uuid,
    width: 16,
    height: 16,
    size: 106,
    type: "png",
    color: "e64626",
    hash: "",
    external_service: [],
    base64preview: "/9j/4AAQSkZJRgABAQIA"
  });
});

test("одиночная картинка с media не сворачивается в текст", () => {
  const payload = C.toVcruPayload(C.toBlocks("![[star.png|64]]", mediaOptions));
  const data = parseMediaLine(payload);

  assert.equal(data.items[0].image.data.uuid, MEDIA.uuid);
});

test("media без uuid падает обратно в текст", () => {
  const withoutUuid = { images: { "star.png": { src: PNG, media: { width: 16 } } } };
  const single = C.toVcruPayload(C.toBlocks("![[star.png|64]]", withoutUuid));
  const mixed = C.toVcruPayload(C.toBlocks("Текст\n\n![[star.png|64]]", withoutUuid));

  assert.equal(single, "![[star.png|64]]");
  assert.ok(mixed.includes('[text:{"text":"<p>![[star.png|64]]</p>"}]'));
});

test("объект без src остаётся текстом", () => {
  const blocks = C.toBlocks("![[star.png]]", { images: { "star.png": { media: MEDIA } } });

  assert.equal(blocks[0].type, "text");
  assert.ok(blocks[0].html.includes("![[star.png]]"));
});

test("Дзен и Смартлаб берут src из объекта", () => {
  const blocks = C.toBlocks("![[star.png|64]]", mediaOptions);
  const expected = '<img src="' + PNG + '" alt="star.png" width="64">';

  assert.equal(C.toDzenHtml(blocks), expected);
  assert.equal(C.toSmartlabHtml(blocks), expected);
});

test("фикстуры: star с media, gray без media и короткая", () => {
  require(join(here, "..", "fixtures", "images.js"));
  const images = globalThis.NABORSCHIK_TEST_IMAGES;

  const star = C.toBlocks("![[star.png|64]]", { images })[0];
  assert.equal(star.type, "image");
  assert.ok(star.media && star.media.uuid);
  assert.equal(star.media.width, 16);

  const gray = C.toBlocks("![[gray.png|300]]", { images })[0];
  assert.equal(gray.type, "image");
  assert.equal(gray.media, null);
  assert.ok(gray.src.startsWith("data:image/png;base64,"));
  assert.ok(gray.src.length < 800);
});
