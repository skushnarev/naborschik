import { strict as assert } from "node:assert";
import { test } from "node:test";
import { createImageEntry, createImageResolver, mergeImageEntries, summarizeImages } from "../web/images.ts";
import { SAMPLE_IMAGE_SRC, sampleImageEntry } from "../web/sample.ts";
import { STAR, STAR_SRC } from "./support/star.ts";

function entry(path: string) {
	const value = createImageEntry(path, STAR);
	assert.ok(value, path);
	return value;
}

test("матчер находит файл по пути и по уникальному имени", () => {
	const resolver = createImageResolver([entry("Фото/Star.png")]);

	assert.deepEqual(resolver("фото/star.png"), { src: STAR_SRC, width: 16 });
	assert.deepEqual(resolver("star.png"), { src: STAR_SRC, width: 16 });
	assert.equal(resolver("other.png"), null);
});

test("матчер нормализует слэши, регистр и ведущий ./", () => {
	const resolver = createImageResolver([entry("photos/star.png")]);

	assert.deepEqual(resolver("./photos\\STAR.PNG"), { src: STAR_SRC, width: 16 });
});

test("файл с чужим расширением не становится картинкой", () => {
	assert.equal(createImageEntry("notes/article.md", STAR), null);
});

test("одинаковые имена не подставляются по имени, но находятся по пути", () => {
	const resolver = createImageResolver([entry("a/star.png"), entry("b/star.png")]);

	assert.equal(resolver("star.png"), null);
	assert.deepEqual(resolver("a/star.png"), { src: STAR_SRC, width: 16 });
	assert.deepEqual(resolver("B/STAR.PNG"), { src: STAR_SRC, width: 16 });
});

test("свой файл перекрывает встроенную картинку примера по имени", () => {
	const sample = { ...entry("star.png"), sample: true };
	const merged = mergeImageEntries([sample], [entry("photos/star.png")]);

	assert.equal(merged.length, 1);
	assert.equal(merged[0]?.path, "photos/star.png");
	assert.equal(merged[0]?.sample, undefined);
});

test("повторный выбор того же пути не плодит записи", () => {
	const merged = mergeImageEntries([entry("a/star.png")], [entry("A/STAR.PNG")]);

	assert.equal(merged.length, 1);
	assert.equal(merged[0]?.path, "a/star.png");
});

test("сводка считает сопоставленные, ненайденные и неоднозначные имена", () => {
	const entries = [entry("a/star.png"), entry("b/star.png")];
	const summary = summarizeImages(entries, "![[a/star.png]]\n\n![[star.png]]\n\n![[missing.png]]\n\n![[Заметка]]");

	assert.deepEqual(summary.targets, ["a/star.png", "star.png", "missing.png"]);
	assert.equal(summary.matched, 1);
	assert.deepEqual(summary.unmatched, ["star.png", "missing.png"]);
	assert.deepEqual(summary.ambiguous, ["star.png"]);
	assert.equal(summary.totalSize, 212);
});

test("одинаковые имена предупреждают, даже если все цели нашли путь", () => {
	const summary = summarizeImages([entry("a/star.png"), entry("b/star.png")], "![[a/star.png]]");

	assert.deepEqual(summary.unmatched, []);
	assert.deepEqual(summary.ambiguous, ["star.png"]);
});

test("встроенная картинка примера совпадает с фикстурой", () => {
	const entry = sampleImageEntry();

	assert.equal(SAMPLE_IMAGE_SRC, STAR_SRC);
	assert.equal(entry.name, "star.png");
	assert.equal(entry.size, STAR.length);
	assert.equal(entry.asset.width, 16);
	assert.equal(entry.sample, true);
});
