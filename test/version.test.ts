import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const script = join(root, "bin", "check-version.mjs");
const version = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;

function run(args: string[] = [], cwd = root) {
	return spawnSync(process.execPath, [script, ...args], { cwd, encoding: "utf8" });
}

test("версия плагина согласована в трёх файлах", () => {
	const result = run();
	assert.equal(result.status, 0, result.stderr || result.stdout);
	assert.match(result.stdout, /Версия согласована: \d+\.\d+\.\d+/);
});

test("тег совпадает с версией плагина", () => {
	const result = run([version]);
	assert.equal(result.status, 0, result.stderr || result.stdout);
	assert.match(result.stdout, /Версия и тег согласованы/);
});

test("тег с другой версией роняет проверку", () => {
	const [major, minor, patch] = version.split(".").map(Number);
	const result = run([`${major}.${minor}.${patch + 1}`]);
	assert.equal(result.status, 1);
	assert.match(result.stderr, /не совпадает/);
});

test("тег с префиксом v роняет проверку", () => {
	const result = run([`v${version}`]);
	assert.equal(result.status, 1);
	assert.match(result.stderr, /префикс v/);
});

test("расхождение package.json и manifest.json роняет проверку", () => {
	const temp = mkdtempSync(join(tmpdir(), "naborschik-version-"));

	try {
		for (const file of ["package.json", "package-lock.json", "manifest.json"]) {
			cpSync(join(root, file), join(temp, file));
		}

		const manifestPath = join(temp, "manifest.json");
		const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
		manifest.version = "9.9.9";
		writeFileSync(manifestPath, JSON.stringify(manifest, null, "\t") + "\n");

		const result = run([], temp);
		assert.equal(result.status, 1);
		assert.match(result.stderr, /Версии расходятся/);
	} finally {
		rmSync(temp, { recursive: true, force: true });
	}
});
