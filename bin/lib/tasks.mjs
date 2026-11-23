import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

export const STATUSES = ["todo", "doing", "done", "blocked"];
export const RESOLUTIONS = ["fixed", "wontfix", "accepted", "duplicate", "obsolete"];
export const MILESTONES = ["mvp", "next", "later"];

const REQUIRED = ["id", "title", "status", "area", "kind", "updated"];
const ID_PATTERN = /^[A-Z][A-Z0-9]*-\d{2,}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function unquote(value) {
  if (value.startsWith('"') && value.endsWith('"')) {
    try {
      return JSON.parse(value);
    } catch {
      return value.slice(1, -1);
    }
  }
  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1);
  }
  return value;
}

export function parseFrontMatter(file) {
  const text = readFileSync(file, "utf8");
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;

  const data = {};
  for (const raw of match[1].split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf(":");
    if (index < 1) continue;

    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();

    if (value.startsWith("[") && value.endsWith("]")) {
      value = value
        .slice(1, -1)
        .split(",")
        .map((item) => unquote(item.trim()))
        .filter(Boolean);
    } else {
      value = unquote(value);
    }

    data[key] = value;
  }

  return data;
}

function listIssueFiles(issuesDir) {
  if (!existsSync(issuesDir) || !statSync(issuesDir).isDirectory()) return [];
  return readdirSync(issuesDir)
    .filter((file) => file.endsWith(".md"))
    .sort()
    .map((file) => join(issuesDir, file));
}

export function loadTasks(root) {
  const scratch = join(root, ".scratch");
  const tasks = [];
  const features = [];

  if (!existsSync(scratch)) return { tasks, features };

  for (const entry of readdirSync(scratch, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;

    const feature = entry.name;
    const featureDir = join(scratch, feature);
    const issues = listIssueFiles(join(featureDir, "issues"));
    const spec = join(featureDir, "spec.md");

    features.push({ feature, dir: featureDir, spec, issues });

    for (const file of issues) {
      const data = parseFrontMatter(file);
      if (!data) continue;

      tasks.push({
        ...data,
        id: String(data.id ?? "").trim(),
        title: String(data.title ?? "").trim(),
        status: String(data.status ?? "").trim(),
        area: String(data.area ?? "").trim(),
        kind: String(data.kind ?? "").trim(),
        severity: String(data.severity ?? "").trim(),
        milestone: String(data.milestone ?? "mvp").trim(),
        blockedBy: Array.isArray(data.blocked_by) ? data.blocked_by : [],
        spec: String(data.spec ?? "").trim(),
        resolution: String(data.resolution ?? "").trim(),
        updated: String(data.updated ?? "").trim(),
        feature,
        file: relative(root, file).split(sep).join("/"),
      });
    }
  }

  tasks.sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true }));
  return { tasks, features };
}

export function validate(root, tasks, features) {
  const errors = [];
  const byId = new Map();

  for (const task of tasks) {
    const where = task.file || task.id || "задача";

    for (const field of REQUIRED) {
      const value = field === "blocked_by" ? task.blockedBy : task[field];
      if (value === "" || value === undefined || (Array.isArray(value) && value.length === 0 && field === "blocked_by")) {
        if (field === "blocked_by") continue;
        errors.push(`${where}: нет обязательного поля ${field}`);
      }
    }

    if (!ID_PATTERN.test(task.id)) {
      errors.push(`${where}: id должен выглядеть как POD-01`);
    } else if (byId.has(task.id)) {
      errors.push(`${where}: id ${task.id} уже занят в ${byId.get(task.id).file}`);
    } else {
      byId.set(task.id, task);
    }

    if (!STATUSES.includes(task.status)) {
      errors.push(`${where}: status должен быть одним из ${STATUSES.join(", ")}`);
    }

    if (!MILESTONES.includes(task.milestone)) {
      errors.push(`${where}: milestone должен быть одним из ${MILESTONES.join(", ")}`);
    }

    if (task.severity && !/^P[0-3]$/.test(task.severity)) {
      errors.push(`${where}: severity должен быть P0..P3`);
    }

    if (!DATE_PATTERN.test(task.updated)) {
      errors.push(`${where}: updated должен быть в формате YYYY-MM-DD`);
    }

    if (task.status === "blocked" && task.blockedBy.length === 0) {
      errors.push(`${where}: у blocked нужен blocked_by`);
    }

    if (task.status !== "blocked" && task.blockedBy.length > 0) {
      errors.push(`${where}: blocked_by заполняется только у status: blocked`);
    }

    if (task.status === "done" && task.resolution && !RESOLUTIONS.includes(task.resolution)) {
      errors.push(`${where}: resolution должен быть одним из ${RESOLUTIONS.join(", ")}`);
    }

    if (task.spec && !existsSync(join(root, task.spec))) {
      errors.push(`${where}: spec не найден: ${task.spec}`);
    }
  }

  for (const feature of features) {
    if (feature.issues.length > 0 && !existsSync(feature.spec)) {
      errors.push(`${relative(root, feature.dir)}: у фичи с задачами нет spec.md`);
    }
  }

  for (const task of tasks) {
    for (const blocker of task.blockedBy) {
      if (blocker === "human") continue;
      if (!byId.has(blocker)) {
        errors.push(`${task.file}: blocked_by ссылается на неизвестную задачу ${blocker}`);
      }
      if (blocker === task.id) {
        errors.push(`${task.file}: задача блокирует сама себя`);
      }
    }
  }

  errors.push(...findCycles(tasks));
  return errors;
}

function findCycles(tasks) {
  const errors = [];
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const state = new Map();

  function visit(id, stack) {
    if (state.get(id) === "done") return;
    if (state.get(id) === "visiting") {
      const cycle = [...stack.slice(stack.indexOf(id)), id].join(" -> ");
      errors.push(`Цикл блокировок: ${cycle}`);
      return;
    }

    state.set(id, "visiting");
    const task = byId.get(id);
    if (task) {
      for (const blocker of task.blockedBy) {
        if (blocker !== "human" && byId.has(blocker)) visit(blocker, [...stack, id]);
      }
    }
    state.set(id, "done");
  }

  for (const task of tasks) visit(task.id, []);
  return errors;
}

export function matchesRange(id, selector) {
  if (!selector.includes("..")) return id === selector;

  const [from, to] = selector.split("..");
  const left = from.match(/^(.*?)(\d+)$/);
  const right = to.match(/^(.*?)(\d+)$/);
  const current = id.match(/^(.*?)(\d+)$/);
  if (!left || !right || !current) return id === from || id === to;
  if (left[1] !== right[1] || left[1] !== current[1]) return id === from || id === to;

  const number = Number(current[2]);
  return number >= Number(left[2]) && number <= Number(right[2]);
}
