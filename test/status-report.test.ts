import { strict as assert } from "node:assert";
import { test } from "node:test";
import { formatReport } from "../bin/lib/report.mjs";
import type { ReportTask } from "../bin/lib/report.mjs";

function task(id: string, overrides: Partial<ReportTask> = {}): ReportTask {
	return {
		id,
		status: "todo",
		severity: "P2",
		area: "obsidian-plugin",
		milestone: "next",
		title: `Задача ${id}`,
		kind: "feature",
		...overrides,
	};
}

test("таблица выравнивает колонки по содержимому", () => {
	const output = formatReport([
		task("PM-08", { title: "Итоговая строка" }),
		task("VC-01", { area: "vc-converter", milestone: "mvp", title: "Первый блок" }),
	]);
	const [header = "", first = "", second = ""] = output.split("\n");

	assert.match(header, /^ID\s+STATUS\s+SEV\s+AREA\s+MILESTONE\s+TITLE$/);
	assert.equal(first.indexOf("next"), header.indexOf("MILESTONE"));
	assert.equal(second.indexOf("mvp"), header.indexOf("MILESTONE"));
	assert.equal(first.indexOf("Итоговая строка"), header.indexOf("TITLE"));
});

test("итог считает done, даже когда строки скрыты", () => {
	const output = formatReport([
		task("PM-01", { status: "done", title: "Закрытая задача" }),
		task("PM-08", { title: "Открытая задача" }),
	]);

	assert.doesNotMatch(output, /Закрытая задача/);
	assert.match(output, /Всего: 2 - todo 1, doing 0, blocked 0, done 1; mvp 0, next 2, later 0/);
	assert.match(output, /Скрыто done: 1, добавьте --all/);
});

test("--all показывает done и убирает подсказку", () => {
	const output = formatReport(
		[task("PM-01", { status: "done", title: "Закрытая задача" }), task("PM-08", { title: "Открытая задача" })],
		{ all: true }
	);

	assert.match(output, /Закрытая задача/);
	assert.doesNotMatch(output, /Скрыто done/);
});

test("выборка по ID показывает done без --all и без подсказки", () => {
	const output = formatReport([task("PM-01", { status: "done", title: "Закрытая задача" })], {
		selectors: ["PM-01"],
	});

	assert.match(output, /Закрытая задача/);
	assert.match(output, /Итого по выборке: 1 - todo 0, doing 0, blocked 0, done 1/);
	assert.doesNotMatch(output, /Скрыто done/);
});

test("фильтр по статусу считает только выбранные статусы", () => {
	const output = formatReport(
		[
			task("PM-01", { status: "done", title: "Закрытая задача" }),
			task("PM-08", { status: "blocked", title: "Заблокированная задача" }),
		],
		{ statuses: ["done"] }
	);

	assert.match(output, /Закрытая задача/);
	assert.doesNotMatch(output, /Заблокированная задача/);
	assert.match(output, /Итого по выборке: 1 - todo 0, doing 0, blocked 0, done 1/);
});

test("фильтр по area считает итог по выборке, включая done", () => {
	const output = formatReport(
		[
			task("PM-01", { status: "done", title: "Закрытая плагинная" }),
			task("PM-08", { title: "Открытая плагинная" }),
			task("VC-01", { area: "vc-converter", milestone: "mvp", title: "Чужая задача" }),
		],
		{ area: "obsidian-plugin" }
	);

	assert.doesNotMatch(output, /Чужая задача/);
	assert.match(output, /Итого по выборке: 2 - todo 1, doing 0, blocked 0, done 1; mvp 0, next 2, later 0/);
	assert.match(output, /Скрыто done: 1, добавьте --all/);
});

test("пустой результат сообщает об отсутствии задач и печатает нулевой итог", () => {
	const output = formatReport([]);

	assert.match(output, /^Задачи не найдены\./);
	assert.match(output, /Всего: 0 - todo 0, doing 0, blocked 0, done 0; mvp 0, next 0, later 0/);
});

test("пустая выборка по фильтру подписана как выборка", () => {
	const output = formatReport([task("PM-08", { area: "obsidian-plugin" })], { area: "vc-converter" });

	assert.match(output, /^Задачи не найдены\./);
	assert.match(output, /Итого по выборке: 0 - todo 0, doing 0, blocked 0, done 0/);
});

test("когда всё закрыто, пустой вывод говорит об открытых задачах", () => {
	const output = formatReport([task("PM-01", { status: "done", title: "Закрытая задача" })]);

	assert.match(output, /^Открытых задач нет\./);
	assert.match(output, /Скрыто done: 1, добавьте --all/);
});
