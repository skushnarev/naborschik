import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { PLATFORMS } from "../src/platforms/index.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const fixtures = join(root, "test", "fixtures");

test("генератор golden собирает фикстуры из src без расхождений", () => {
	const temp = mkdtempSync(join(tmpdir(), "naborschik-golden-"));
	const target = join(temp, "test", "fixtures");

	try {
		mkdirSync(target, { recursive: true });
		cpSync(join(fixtures, "article.md"), join(target, "article.md"));

		const result = spawnSync(process.execPath, [join(root, "bin", "make-golden.mjs")], {
			cwd: temp,
			encoding: "utf8"
		});

		assert.equal(result.status, 0, result.error?.message || result.stderr || result.stdout);

		const generated = readdirSync(target)
			.filter((file) => file !== "article.md")
			.sort();
		const expected = [
			"article.expected.json",
			...PLATFORMS.flatMap((adapter) => {
				const extension = existsSync(join(fixtures, `article.${adapter.id}.html`)) ? "html" : "txt";
				return [`article.${adapter.id}.${extension}`, `${adapter.id}-single.json`];
			})
		].sort();

		assert.deepEqual(generated, expected, "генератор собрал не тот набор фикстур");

		const committed = readdirSync(fixtures)
			.filter((file) => file !== "article.md" && (file.startsWith("article.") || file.endsWith("-single.json")))
			.sort();
		assert.deepEqual(committed, expected, "набор эталонов разошёлся с PLATFORMS: пересоберите make golden или удалите лишние");

		for (const file of expected) {
			assert.ok(existsSync(join(fixtures, file)), `нет эталона ${file}`);
			assert.equal(readFileSync(join(target, file), "utf8"), readFileSync(join(fixtures, file), "utf8"), file);
		}
	} finally {
		rmSync(temp, { recursive: true, force: true });
	}
});
