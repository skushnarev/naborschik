#!/usr/bin/env node
// Показывает задачи из .scratch/<feature>/issues/.
//
// Примеры:
//   node bin/status.mjs
//   node bin/status.mjs POD-01..POD-05
//   node bin/status.mjs --all --area podcast
//   node bin/status.mjs --status blocked
//   node bin/status.mjs --json
//   node bin/status.mjs --check

import { join, resolve } from "node:path";
import { existsSync } from "node:fs";
import { loadTasks, validate, MILESTONES, STATUSES } from "./lib/tasks.mjs";
import { formatReport, selectTasks } from "./lib/report.mjs";

const root = resolve(import.meta.dirname, "..");
const selectors = [];
let all = false;
let json = false;
let check = false;
let statusFilter = null;
let area = null;
let kind = null;
let milestone = null;

const args = process.argv.slice(2);
for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];

  if (arg === "-h" || arg === "--help") {
    usage();
    process.exit(0);
  }
  if (arg === "--all") {
    all = true;
    continue;
  }
  if (arg === "--json") {
    json = true;
    continue;
  }
  if (arg === "--check") {
    check = true;
    continue;
  }
  if (["--area", "--status", "--kind", "--milestone"].includes(arg)) {
    const value = args[index + 1];
    index += 1;
    if (!value) fail(`Нужно значение после ${arg}`);
    if (arg === "--area") area = value;
    if (arg === "--status") statusFilter = value;
    if (arg === "--kind") kind = value;
    if (arg === "--milestone") milestone = value;
    continue;
  }
  if (arg.startsWith("--area=")) area = arg.slice(7);
  else if (arg.startsWith("--status=")) statusFilter = arg.slice(9);
  else if (arg.startsWith("--kind=")) kind = arg.slice(7);
  else if (arg.startsWith("--milestone=")) milestone = arg.slice(12);
  else if (arg.startsWith("-")) fail(`Неизвестная опция: ${arg}`);
  else selectors.push(arg);
}

if (!existsSync(join(root, ".scratch"))) {
  console.log("Задачи не найдены: нет .scratch/.");
  process.exit(0);
}

const { tasks, features } = loadTasks(root);
const errors = validate(root, tasks, features);

if (check) {
  if (errors.length > 0) {
    for (const error of errors) console.error(`ERROR: ${error}`);
    console.error(`Проверка задач не пройдена: ${errors.length} ошибок`);
    process.exit(1);
  }
  console.log(`Задачи в порядке: ${tasks.length}`);
  process.exit(0);
}

let statuses = null;
if (statusFilter) {
  const wanted = statusFilter.split(",").map((item) => item.trim()).filter(Boolean);
  if (wanted.length === 0 || wanted.some((item) => !STATUSES.includes(item))) {
    fail(`--status принимает статусы через запятую: ${STATUSES.join(", ")}`);
  }
  statuses = wanted;
}

const filters = { selectors, statuses, area, kind, milestone, all };

if (json) {
  const { shown } = selectTasks(tasks, filters);
  const payload = shown.map((task) => ({
    id: task.id,
    title: task.title,
    status: task.status,
    area: task.area,
    kind: task.kind,
    severity: task.severity,
    milestone: task.milestone,
    blocked_by: task.blockedBy,
    spec: task.spec,
    resolution: task.resolution,
    updated: task.updated,
    feature: task.feature,
    file: task.file,
  }));
  console.log(JSON.stringify(payload, null, 2));
  process.exit(errors.length > 0 ? 1 : 0);
}

console.log(formatReport(tasks, filters));

if (errors.length > 0) {
  console.error("");
  for (const error of errors) console.error(`WARN: ${error}`);
  process.exit(1);
}

function fail(message) {
  console.error(message);
  process.exit(2);
}

function usage() {
  console.log(`Использование: node bin/status.mjs [ОПЦИИ] [ID|ДИАПАЗОН...]

Без аргументов показывает todo, doing и blocked.
ID, диапазон или фильтр выводят задачи во всех статусах.

Опции:
  --all             показать и done
  --area <area>     фильтр по area, например podcast
  --kind <kind>     фильтр по kind, например feature
  --milestone <m>   фильтр по milestone: ${MILESTONES.join(", ")}
  --status <list>   статусы через запятую: ${STATUSES.join(",")}
  --json            машинный вывод
  --check           проверить front matter, ссылки и циклы
  -h, --help        эта справка

Примеры:
  node bin/status.mjs
  node bin/status.mjs POD-01..POD-05
  node bin/status.mjs --all --area podcast
  node bin/status.mjs --status blocked
  node bin/status.mjs --check

Через make:
  make status
  make status ARGS="POD-01..POD-05"
`);
}
