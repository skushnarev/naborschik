import { strict as assert } from "node:assert";
import { test } from "node:test";
import { PLATFORMS } from "../src/platforms/index.ts";

test("реестр площадок идёт в порядке меню", () => {
	assert.deepEqual(
		PLATFORMS.map((platform) => platform.id),
		["vcru", "dzen", "smartlab"]
	);
});
