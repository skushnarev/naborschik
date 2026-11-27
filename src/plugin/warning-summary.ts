import type { Warning } from "../core/types.ts";

export type WarningGroup = {
	title: string;
	detail: string;
	count: number;
};

export type WarningSummary = {
	count: number;
	first: string;
	groups: WarningGroup[];
};

const ACTIONS: Record<string, string> = {
	"image-unresolved": "Файл останется текстом. Проверьте имя файла и папку вложений.",
	"code-degraded": "Блок потеряет подсветку и форматирование. Проверьте его после вставки.",
	"table-degraded": "Таблица станет списком пар «колонка: значение». Проверьте читаемость после вставки."
};

const FALLBACK_ACTION = "Проверьте этот фрагмент после вставки.";

export function formatSuccessNotice(forWhom: string, chars: number): string {
	return "Скопировано для " + forWhom + ", символов: " + chars;
}

/** Строка успешного копирования с короткой причиной первого предупреждения. */
export function formatCopyNotice(forWhom: string, chars: number, summary: WarningSummary): string {
	const first = /[.!?]$/.test(summary.first) ? summary.first : summary.first + ".";
	return formatSuccessNotice(forWhom, chars) + ", предупреждений: " + summary.count + ". " + first;
}

/** Короткая причина для уведомления и сгруппированный список для модалки. */
export function summarizeWarnings(warnings: Warning[]): WarningSummary | null {
	if (warnings.length === 0) return null;

	const groups = new Map<string, WarningGroup>();
	for (const warning of warnings) {
		const key = warning.code + "\n" + warning.message;
		const group = groups.get(key);
		if (group) {
			group.count += 1;
			continue;
		}

		groups.set(key, {
			title: warning.message,
			detail: ACTIONS[warning.code] ?? FALLBACK_ACTION,
			count: 1
		});
	}

	const items = [...groups.values()];
	return {
		count: items.reduce((sum, group) => sum + group.count, 0),
		first: items[0]?.title ?? "",
		groups: items
	};
}
