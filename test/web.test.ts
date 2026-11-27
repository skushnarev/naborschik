import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { convertMarkdown } from "../web/convert.ts";
import { createImageEntry, createImageResolver } from "../web/images.ts";
import { STAR } from "./support/star.ts";

function golden(name: string): string {
	return readFileSync(new URL("./fixtures/" + name, import.meta.url), "utf8").replace(/\n$/, "");
}

test("веб-конвертер отдаёт выход трёх площадок", async () => {
	const result = await convertMarkdown("## Глава\n\nТекст\n\n~~~js\nconst x = 1;\n~~~");

	assert.equal(result.blocks.length, 3);
	assert.match(result.outputs.vcru?.payload.plain ?? "", /\[header:/);
	assert.match(result.outputs.dzen?.payload.html ?? "", /<h2>Глава<\/h2>/);
	assert.match(result.outputs.smartlab?.payload.html ?? "", /<h3>Глава<\/h3>/);
});

test("одиночный блок vc.ru уходит текстом", async () => {
	const result = await convertMarkdown("Просто абзац.");

	assert.equal(result.outputs.vcru?.payload.plain, "Просто абзац.");
});

test("веб-конвертер совпадает с golden плагина", async () => {
	const markdown = readFileSync(new URL("./fixtures/article.md", import.meta.url), "utf8");
	const result = await convertMarkdown(markdown);

	assert.equal(result.outputs.vcru?.payload.plain, golden("article.vcru.txt"));
	assert.equal(result.outputs.dzen?.payload.html, golden("article.dzen.html"));
	assert.equal(result.outputs.smartlab?.payload.html, golden("article.smartlab.html"));
});

test("предупреждения разбора и адаптера попадают в выход площадки", async () => {
	const result = await convertMarkdown("![[star.png]]\n\n| A | B |\n|---|---|\n| 1 | 2 |");
	const dzen = result.outputs.dzen;

	assert.ok(dzen);
	assert.ok(dzen.warnings.some((warning) => warning.code === "image-unresolved"));
	assert.ok(dzen.warnings.some((warning) => warning.code === "table-degraded"));
});

test("веб-конвертер подставляет выбранные картинки в Дзен и Смартлаб", async () => {
	const entry = createImageEntry("star.png", STAR);
	assert.ok(entry);

	const result = await convertMarkdown("![[star.png|64]]", createImageResolver([entry]));
	const dzen = result.outputs.dzen?.payload.html ?? "";
	const smartlab = result.outputs.smartlab?.payload.html ?? "";

	assert.equal(result.blocks[0]?.type, "image");
	assert.match(dzen, /^<img src="data:image\/png;base64,/);
	assert.match(dzen, /width="64"/);
	assert.match(smartlab, /^<img src="data:image\/png;base64,/);
	assert.equal(result.outputs.vcru?.payload.plain, "![[star.png|64]]");
});

test("без выбранного файла вставка остаётся текстом с предупреждением", async () => {
	const result = await convertMarkdown("![[missing.png]]", createImageResolver([]));

	assert.deepEqual(result.blocks, [
		{ type: "text", html: "<p>![[missing.png]]</p>", text: "![[missing.png]]" }
	]);
	assert.deepEqual(result.warnings, [
		{ code: "image-unresolved", message: "Картинка не найдена: missing.png" }
	]);
});

test("пустой резолвер не ломает golden статьи", async () => {
	const markdown = readFileSync(new URL("./fixtures/article.md", import.meta.url), "utf8");
	const result = await convertMarkdown(markdown, createImageResolver([]));

	assert.equal(result.outputs.vcru?.payload.plain, golden("article.vcru.txt"));
	assert.equal(result.outputs.dzen?.payload.html, golden("article.dzen.html"));
	assert.equal(result.outputs.smartlab?.payload.html, golden("article.smartlab.html"));
});

test("make public собирает самодостаточный index.html", () => {
	const out = mkdtempSync(join(tmpdir(), "naborschik-web-"));
	try {
		const run = spawnSync(process.execPath, ["bin/build-public.mjs", out], { encoding: "utf8" });

		assert.equal(run.status, 0, run.stderr);

		const file = join(out, "index.html");
		assert.ok(existsSync(file));

		const html = readFileSync(file, "utf8");
		assert.match(html, /^<!doctype html>/);
		assert.match(html, /<style>/);
		assert.match(html, /<script>/);
		assert.match(html, /data-platform/);
		assert.match(html, /vc\.ru/);
		assert.match(html, /Дзен/);
		assert.match(html, /Смартлаб/);
		assert.ok(!html.includes("<script src="));
		assert.ok(!html.includes('rel="stylesheet"'));
		assert.ok(!html.includes("@import"));
		assert.ok(!html.includes("url(http"));
	} finally {
		rmSync(out, { recursive: true, force: true });
	}
});
