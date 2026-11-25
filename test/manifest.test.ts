import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const manifest: Record<string, unknown> = JSON.parse(
	readFileSync(new URL("../manifest.json", import.meta.url), "utf8")
);

test("манифест сохраняет идентичность и версию", () => {
	assert.equal(manifest.id, "naborschik");
	assert.equal(manifest.name, "Naborschik");
	assert.equal(manifest.version, "0.1.0");
	assert.equal(manifest.minAppVersion, "1.5.0");
	assert.equal(manifest.isDesktopOnly, true);
});

test("версия манифеста совпадает с версией пакета", () => {
	const pkg: Record<string, unknown> = JSON.parse(
		readFileSync(new URL("../package.json", import.meta.url), "utf8")
	);

	assert.equal(manifest.version, pkg.version);
});
