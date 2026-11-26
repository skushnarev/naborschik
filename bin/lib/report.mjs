import { matchesRange, MILESTONES, STATUSES } from "./tasks.mjs";

const HEADER = ["ID", "STATUS", "SEV", "AREA", "MILESTONE", "TITLE"];
// Порядок итога исторический: done в конце, а не на своём месте в STATUSES.
const SUMMARY_STATUSES = [...STATUSES.filter((status) => status !== "done"), "done"];

export function selectTasks(tasks, filters = {}) {
  const {
    selectors = [],
    statuses = null,
    area = null,
    kind = null,
    milestone = null,
    all = false,
  } = filters;

  const byIdOrStatus = selectors.length > 0 || statuses !== null;
  const hasFilters = byIdOrStatus || area !== null || kind !== null || milestone !== null;

  let matching = tasks;
  if (selectors.length > 0) {
    matching = matching.filter((task) => selectors.some((selector) => matchesRange(task.id, selector)));
  }
  if (statuses) matching = matching.filter((task) => statuses.includes(task.status));
  if (area) matching = matching.filter((task) => task.area === area);
  if (kind) matching = matching.filter((task) => task.kind === kind);
  if (milestone) matching = matching.filter((task) => task.milestone === milestone);

  // Без --all прячем done, но итог считаем по всей выборке.
  const hideDone = !all && !byIdOrStatus;
  const shown = hideDone ? matching.filter((task) => task.status !== "done") : matching;

  return { shown, matching, hiddenDone: matching.length - shown.length, hasFilters };
}

export function formatReport(tasks, filters = {}) {
  const { shown, matching, hiddenDone, hasFilters } = selectTasks(tasks, filters);
  const lines = [];

  if (shown.length === 0) {
    lines.push(hiddenDone > 0 ? "Открытых задач нет." : "Задачи не найдены.");
  } else {
    lines.push(formatTable(shown));
  }

  lines.push("");
  lines.push(formatSummary(matching, hasFilters, hiddenDone));
  return lines.join("\n");
}

function formatTable(tasks) {
  const rows = [
    HEADER,
    ...tasks.map((task) => [task.id, task.status, task.severity || "-", task.area, task.milestone, task.title]),
  ];
  const widths = HEADER.slice(0, -1).map((_, index) =>
    Math.max(...rows.map((cells) => cells[index].length)),
  );

  return rows
    .map((cells) =>
      cells
        .map((cell, index) => (index === cells.length - 1 ? cell : cell.padEnd(widths[index])))
        .join(" "),
    )
    .join("\n");
}

function formatSummary(tasks, narrowed, hiddenDone) {
  const statuses = Object.fromEntries(STATUSES.map((status) => [status, 0]));
  const milestones = Object.fromEntries(MILESTONES.map((item) => [item, 0]));

  for (const task of tasks) {
    statuses[task.status] = (statuses[task.status] ?? 0) + 1;
    milestones[task.milestone] = (milestones[task.milestone] ?? 0) + 1;
  }

  const label = narrowed ? "Итого по выборке" : "Всего";
  const line =
    `${label}: ${tasks.length} - ` +
    SUMMARY_STATUSES.map((status) => `${status} ${statuses[status]}`).join(", ") +
    "; " +
    MILESTONES.map((item) => `${item} ${milestones[item]}`).join(", ");

  return hiddenDone > 0 ? `${line}\nСкрыто done: ${hiddenDone}, добавьте --all` : line;
}
