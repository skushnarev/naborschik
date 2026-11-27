import { parse } from "../src/core/parse.ts";
import { PLATFORMS } from "../src/platforms/index.ts";
import type { Block, ClipboardPayload, Warning } from "../src/core/types.ts";

export type PlatformOutput = {
	payload: ClipboardPayload;
	warnings: Warning[];
};

export type Conversion = {
	blocks: Block[];
	warnings: Warning[];
	outputs: Record<string, PlatformOutput>;
};

/**
 * Markdown в выходы всех площадок. Веб-версия использует то же ядро и те же
 * адаптеры, что плагин: отдельного конвертера для браузера нет.
 */
export async function convertMarkdown(markdown: string): Promise<Conversion> {
	const doc = parse(markdown);
	const outputs: Record<string, PlatformOutput> = {};

	for (const adapter of PLATFORMS) {
		const ctx = { warnings: [...doc.warnings] };
		outputs[adapter.id] = {
			payload: await adapter.convert(doc, ctx),
			warnings: ctx.warnings
		};
	}

	return { blocks: doc.blocks, warnings: doc.warnings, outputs };
}
