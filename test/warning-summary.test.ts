import { strict as assert } from "node:assert";
import { test } from "node:test";
import type { Warning } from "../src/core/types.ts";
import {
	formatCopyNotice,
	formatSuccessNotice,
	summarizeWarnings
} from "../src/plugin/warning-summary.ts";

test("ненайденная картинка попадает в короткую причину и список", () => {
	const summary = summarizeWarnings([
		{ code: "image-unresolved", message: "Картинка не найдена: missing.png" }
	]);

	assert.equal(summary?.count, 1);
	assert.equal(summary?.first, "Картинка не найдена: missing.png");
	assert.deepEqual(summary?.groups, [
		{
			title: "Картинка не найдена: missing.png",
			detail: "Файл останется текстом. Проверьте имя файла и папку вложений.",
			count: 1
		}
	]);
});

test("без предупреждений сводки нет", () => {
	assert.equal(summarizeWarnings([]), null);
});

test("повтор одной деградации схлопывается в одну строку со счётчиком", () => {
	const summary = summarizeWarnings([
		{ code: "code-degraded", message: "Код в Дзене станет цитатой" },
		{ code: "code-degraded", message: "Код в Дзене станет цитатой" },
		{ code: "table-degraded", message: "Таблица в Дзене станет списком" }
	]);

	assert.equal(summary?.count, 3);
	assert.equal(summary?.first, "Код в Дзене станет цитатой");
	assert.deepEqual(summary?.groups, [
		{
			title: "Код в Дзене станет цитатой",
			detail: "Блок потеряет подсветку и форматирование. Проверьте его после вставки.",
			count: 2
		},
		{
			title: "Таблица в Дзене станет списком",
			detail: "Таблица станет списком пар «колонка: значение». Проверьте читаемость после вставки.",
			count: 1
		}
	]);
});

test("разные ненайденные файлы остаются отдельными строками", () => {
	const summary = summarizeWarnings([
		{ code: "image-unresolved", message: "Картинка не найдена: first.png" },
		{ code: "image-unresolved", message: "Картинка не найдена: second.png" }
	]);

	assert.deepEqual(
		summary?.groups.map((group) => group.title),
		["Картинка не найдена: first.png", "Картинка не найдена: second.png"]
	);
	assert.deepEqual(
		summary?.groups.map((group) => group.count),
		[1, 1]
	);
});

test("успешное копирование остаётся коротким", () => {
	assert.equal(formatSuccessNotice("Дзена", 1234), "Скопировано для Дзена, символов: 1234");
});

test("уведомление сохраняет счётчик и показывает первую причину", () => {
	const summary = summarizeWarnings([
		{ code: "code-degraded", message: "Код в Дзене станет цитатой" },
		{ code: "table-degraded", message: "Таблица в Дзене станет списком" }
	]);
	assert.ok(summary);

	assert.equal(
		formatCopyNotice("Дзена", 1234, summary),
		"Скопировано для Дзена, символов: 1234, предупреждений: 2. Код в Дзене станет цитатой."
	);
});

test("точка в сообщении не удваивается", () => {
	const summary = summarizeWarnings([
		{ code: "code-degraded", message: "Код в Дзене станет цитатой." }
	]);
	assert.ok(summary);

	assert.equal(
		formatCopyNotice("Дзена", 10, summary),
		"Скопировано для Дзена, символов: 10, предупреждений: 1. Код в Дзене станет цитатой."
	);
});

test("вопросительный знак в сообщении сохраняется", () => {
	const summary = summarizeWarnings([
		{ code: "code-degraded", message: "Проверить код?" }
	]);
	assert.ok(summary);

	assert.equal(
		formatCopyNotice("Дзена", 10, summary),
		"Скопировано для Дзена, символов: 10, предупреждений: 1. Проверить код?"
	);
});

test("незнакомый код показывает исходное сообщение и общий совет", () => {
	const warnings = [
		{ code: "image-too-large", message: "Фото больше лимита площадки" }
	] as unknown as Warning[];
	const summary = summarizeWarnings(warnings);

	assert.equal(summary?.first, "Фото больше лимита площадки");
	assert.deepEqual(summary?.groups, [
		{
			title: "Фото больше лимита площадки",
			detail: "Проверьте этот фрагмент после вставки.",
			count: 1
		}
	]);
});
