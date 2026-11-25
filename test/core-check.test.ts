import { strict as assert } from "node:assert";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("../bin/core-check.mjs", import.meta.url));

test("проверка чистоты падает на импорте obsidian", () => {
	const directory = mkdtempSync(join(tmpdir(), "naborschik-core-"));

	try {
		const source = join(directory, "src", "core");
		mkdirSync(source, { recursive: true });

		writeFileSync(join(source, "bad.ts"), 'import { Notice } from "obsidian";\n');
		const failed = spawnSync(process.execPath, [script], { cwd: directory, encoding: "utf8" });
		assert.equal(failed.status, 1);
		assert.match(failed.stderr, /bad\.ts/);

		writeFileSync(join(source, "bad.ts"), 'import { join } from "node:path";\n');
		const passed = spawnSync(process.execPath, [script], { cwd: directory, encoding: "utf8" });
		assert.equal(passed.status, 0);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
