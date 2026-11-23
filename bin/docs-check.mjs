#!/usr/bin/env node
// Проверяет задачи и не даёт вернуть чеклисты и статусы в нарративные документы.
//
// Запуск: node bin/docs-check.mjs

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { loadTasks, validate } from "./lib/tasks.mjs";

const root = resolve(import.meta.dirname, "..");
const errors = [];

const { tasks, features } = loadTasks(root);
errors.push(...validate(root, tasks, features));

for (const file of narrativeFiles()) {
  const path = join(root, file);
  const lines = readFileSync(path, "utf8").split(/\r?\n/);
  const isAdr = file.startsWith("docs/adr/");
  let inFence = false;

  lines.forEach((line, index) => {
    if (line.trim().startsWith("```")) {
      inFence = !inFence;
      return;
    }
    if (inFence) return;

    const location = `${file}:${index + 1}`;

    if (/^\s*[-*]\s+\[[ xX]\]/.test(line)) {
      errors.push(`${location}: чеклист задачи; статус хранится в .scratch/<feature>/issues/`);
    }

    if (!isAdr && /^Status:\s*/i.test(line)) {
      errors.push(`${location}: строка Status устарела; используйте front matter задачи`);
    }

    if (!isAdr && /^Blocked by:\s*/i.test(line)) {
      errors.push(`${location}: строка Blocked by устарела; используйте blocked_by`);
    }

    if (/^\|\s*[A-Z][A-Z0-9]*-\d{2,}/.test(line)) {
      errors.push(`${location}: таблица задач; используйте make status`);
    }
  });
}

if (errors.length > 0) {
  for (const error of errors) console.error(`ERROR: ${error}`);
  console.error(`Проверка документации не пройдена: ${errors.length} ошибок`);
  process.exit(1);
}

console.log(`Документация в порядке: ${narrativeFiles().length} файлов, задачи без ошибок.`);

function narrativeFiles() {
  const files = [];

  for (const name of ["README.md", "PLAN.md", "AGENTS.md", "GLOSSARY.md"]) {
    if (existsSync(join(root, name))) files.push(name);
  }

  walk(join(root, "docs"), files, root);
  walkJoin(join(root, ".scratch"), files, root);

  return [...new Set(files)].sort();
}

function walk(directory, files, base) {
  if (!existsSync(directory) || !statSync(directory).isDirectory()) return;

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(path, files, base);
    } else if (entry.name.endsWith(".md")) {
      files.push(relativeTo(path, base));
    }
  }
}

function walkJoin(scratch, files, base) {
  if (!existsSync(scratch) || !statSync(scratch).isDirectory()) return;

  for (const entry of readdirSync(scratch, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const featureDir = join(scratch, entry.name);

    for (const name of ["spec.md", "map.md", "retro.md"]) {
      const path = join(featureDir, name);
      if (existsSync(path) && statSync(path).isFile()) files.push(relativeTo(path, base));
    }
  }
}

function relativeTo(path, base) {
  return relative(base, path).split(sep).join("/");
}
