import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { imageTargets, parseImageEmbed, resolveImages, toImageAsset } from "../src/core/images.ts";
import { parse } from "../src/core/parse.ts";
import type { Document } from "../src/core/types.ts";
import { dzenAdapter } from "../src/platforms/dzen.ts";
import { smartlabAdapter } from "../src/platforms/smartlab.ts";
import { vcruAdapter } from "../src/platforms/vcru.ts";
import { STAR, STAR_SRC } from "./support/star.ts";

async function photoDocument(markdown: string): Promise<Document> {
	const images = await resolveImages(imageTargets(markdown), async (target) =>
		target === "star.png" ? { path: "star.png", bytes: STAR } : null
	);
	return parse(markdown, { images });
}

test("цели картинок собираются без размера и повторов", () => {
	assert.deepEqual(
		imageTargets("![[BLG016_top.jpg|600]]\n\n![[photos/gray.png]]\n\n![[BLG016_top.jpg|300]]"),
		["BLG016_top.jpg", "photos/gray.png"]
	);
});

test("вставка картинки разбирается на путь и ширину", () => {
	assert.deepEqual(parseImageEmbed("![[BLG/star.png|64]]"), {
		raw: "![[BLG/star.png|64]]",
		target: "BLG/star.png",
		width: 64
	});
	assert.equal(parseImageEmbed("![[Заметка]]")?.width, null);
});

test("файл картинки становится data URI с шириной", () => {
	assert.deepEqual(toImageAsset("media/star.png", STAR), { src: STAR_SRC, width: 16 });
});

test("не картинка не становится data URI", () => {
	assert.equal(toImageAsset("notes/article.md", STAR), null);
});

test("ширина читается у gif, jpeg, webp и bmp", () => {
	const cases: Array<{ path: string; bytes: number[]; width: number }> = [
		{ path: "a.gif", bytes: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x40, 0x01, 0xc8, 0x00], width: 320 },
		{
			path: "a.jpg",
			bytes: [
				0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, ...new Array<number>(14).fill(0),
				0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x10, 0x00, 0x20, 0x03,
				...new Array<number>(9).fill(0), 0xff, 0xd9
			],
			width: 32
		},
		{
			path: "a.webp",
			bytes: [
				0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
				0x56, 0x50, 0x38, 0x58, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
				0x7f, 0x02, 0x00, 0x7f, 0x02, 0x00
			],
			width: 640
		},
		{
			path: "a.bmp",
			bytes: [0x42, 0x4d, ...new Array<number>(16).fill(0), 0x64, 0x00, 0x00, 0x00, ...new Array<number>(34).fill(0)],
			width: 100
		}
	];

	for (const item of cases) {
		assert.equal(toImageAsset(item.path, Uint8Array.from(item.bytes))?.width, item.width, item.path);
	}
});

test("резолвер хранит картинку по цели вставки", async () => {
	const resolver = await resolveImages(["photos/star.png"], async () => ({
		path: "photos/star.png",
		bytes: STAR
	}));

	assert.deepEqual(resolver("photos/star.png"), { src: STAR_SRC, width: 16 });
	assert.equal(resolver("star.png"), null);
});

test("ненайденный файл не попадает в резолвер", async () => {
	const resolver = await resolveImages(["missing.png"], async () => null);

	assert.equal(resolver("missing.png"), null);
});

test("файл без поддержки формата не попадает в резолвер", async () => {
	const resolver = await resolveImages(["notes/article.md"], async () => ({
		path: "notes/article.md",
		bytes: STAR
	}));

	assert.equal(resolver("notes/article.md"), null);
});

test("golden: фото из хранилища уходит img в Дзен и Смартлаб", async () => {
	const markdown = readFileSync(new URL("./fixtures/photo.md", import.meta.url), "utf8");
	const doc = await photoDocument(markdown);

	const dzen = (await dzenAdapter.convert(doc, { warnings: doc.warnings })).html ?? "";
	const smartlab = (await smartlabAdapter.convert(doc, { warnings: doc.warnings })).html ?? "";

	assert.equal(
		dzen,
		readFileSync(new URL("./fixtures/photo.dzen.html", import.meta.url), "utf8").replace(/\n$/, "")
	);
	assert.equal(
		smartlab,
		readFileSync(new URL("./fixtures/photo.smartlab.html", import.meta.url), "utf8").replace(/\n$/, "")
	);
});

test("golden: vc.ru получает строку картинки текстом", async () => {
	const markdown = readFileSync(new URL("./fixtures/photo.md", import.meta.url), "utf8");
	const doc = await photoDocument(markdown);
	const payload = await vcruAdapter.convert(doc, { warnings: doc.warnings });

	assert.equal(
		payload.plain,
		readFileSync(new URL("./fixtures/photo.vcru.txt", import.meta.url), "utf8").replace(/\n$/, "")
	);
	assert.deepEqual(doc.warnings, []);
});

test("ненайденная картинка остаётся текстом и даёт предупреждение", async () => {
	const markdown = "![[missing.png]]";
	const images = await resolveImages(imageTargets(markdown), async () => null);
	const doc = parse(markdown, { images });

	assert.deepEqual(doc.blocks, [
		{ type: "text", html: "<p>![[missing.png]]</p>", text: "![[missing.png]]" }
	]);
	assert.deepEqual(doc.warnings, [
		{ code: "image-unresolved", message: "Картинка не найдена: missing.png" }
	]);
});
