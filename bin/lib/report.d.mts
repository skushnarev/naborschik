export type ReportTask = {
  id: string;
  status: string;
  severity?: string;
  area: string;
  milestone: string;
  title: string;
  kind?: string;
};

export type ReportFilters = {
  selectors?: string[];
  statuses?: string[] | null;
  area?: string | null;
  kind?: string | null;
  milestone?: string | null;
  all?: boolean;
};

export type ReportSelection = {
  shown: ReportTask[];
  matching: ReportTask[];
  hiddenDone: number;
  hasFilters: boolean;
};

export function selectTasks(tasks: ReportTask[], filters?: ReportFilters): ReportSelection;

export function formatReport(tasks: ReportTask[], filters?: ReportFilters): string;
