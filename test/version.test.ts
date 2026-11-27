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
const files = ["package.json", "package-lock.json", "manifest.json"];

function run(args: string[] = [], cwd = root) {
	return spawnSync(process.execPath, [script, ...args], { cwd, encoding: "utf8" });
}

function readJson(directory: string, file: string) {
	return JSON.parse(readFileSync(join(directory, file), "utf8"));
}

function writeJson(directory: string, file: string, value: unknown) {
	writeFileSync(join(directory, file), JSON.stringify(value, null, "\t") + "\n");
}

function runInCopy(mutate: (directory: string) => void) {
	const temp = mkdtempSync(join(tmpdir(), "naborschik-version-"));

	try {
		for (const file of files) {
			cpSync(join(root, file), join(temp, file));
		}

		mutate(temp);
		return run([], temp);
	} finally {
		rmSync(temp, { recursive: true, force: true });
	}
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

test("расхождение manifest.json роняет проверку", () => {
	const result = runInCopy((directory) => {
		const manifest = readJson(directory, "manifest.json");
		manifest.version = "9.9.9";
		writeJson(directory, "manifest.json", manifest);
	});

	assert.equal(result.status, 1);
	assert.match(result.stderr, /Версии расходятся/);
});

test("расхождение package-lock.json packages[\"\"].version роняет проверку", () => {
	const result = runInCopy((directory) => {
		const lock = readJson(directory, "package-lock.json");
		lock.packages[""].version = "9.9.9";
		writeJson(directory, "package-lock.json", lock);
	});

	assert.equal(result.status, 1);
	assert.match(result.stderr, /Версии расходятся/);
	assert.match(result.stderr, /9\.9\.9/);
});

test("невалидный формат версии даёт одну ошибку без расхождения", () => {
	const result = runInCopy((directory) => {
		const manifest = readJson(directory, "manifest.json");
		manifest.version = "0.1";
		writeJson(directory, "manifest.json", manifest);
	});

	assert.equal(result.status, 1);
	assert.match(result.stderr, /manifest\.json: ожидается версия/);
	assert.doesNotMatch(result.stderr, /Версии расходятся/);
});
