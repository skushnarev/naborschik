import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const manifest: Record<string, unknown> = JSON.parse(
	readFileSync(new URL("../manifest.json", import.meta.url), "utf8")
);

test("манифест пригоден для Obsidian", () => {
	assert.equal(manifest.id, "naborschik");
	assert.equal(manifest.isDesktopOnly, true);
	assert.match(String(manifest.version), /^\d+\.\d+\.\d+$/);
	assert.match(String(manifest.minAppVersion), /^\d+\.\d+\.\d+$/);
});
