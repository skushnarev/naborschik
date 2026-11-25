import { strict as assert } from "node:assert";
import { afterEach, test } from "node:test";
import { writePayload } from "../src/plugin/clipboard.ts";

type WriteCall = { type: "write"; items: FakeClipboardItem[] };
type TextCall = { type: "writeText"; text: string };
type Call = WriteCall | TextCall;

class FakeClipboardItem {
	readonly items: Record<string, Blob>;

	constructor(items: Record<string, Blob>) {
		this.items = items;
	}
}

const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
const clipboardItemDescriptor = Object.getOwnPropertyDescriptor(globalThis, "ClipboardItem");
const consoleErrorDescriptor = Object.getOwnPropertyDescriptor(console, "error");

afterEach(() => {
	restore(globalThis, "navigator", navigatorDescriptor);
	restore(globalThis, "ClipboardItem", clipboardItemDescriptor);
	restore(console, "error", consoleErrorDescriptor);
});

function restore(target: object, name: string, descriptor: PropertyDescriptor | undefined): void {
	if (descriptor) {
		Object.defineProperty(target, name, descriptor);
		return;
	}
	Reflect.deleteProperty(target, name);
}

/**
 * Подменяет только веб-API буфера. Системный буфер, Electron и Obsidian
 * не участвуют, поэтому тест одинаково идёт на любой ОС.
 */
function installClipboard(
	options: { failWrite?: boolean; failText?: boolean; richWrite?: boolean } = {}
): Call[] {
	const calls: Call[] = [];
	const clipboard: {
		write?: (items: FakeClipboardItem[]) => Promise<void>;
		writeText: (text: string) => Promise<void>;
	} = {
		async writeText(text) {
			calls.push({ type: "writeText", text });
			if (options.failText) throw new Error("буфер недоступен");
		}
	};

	if (options.richWrite !== false) {
		clipboard.write = async (items) => {
			calls.push({ type: "write", items });
			if (options.failWrite) throw new Error("буфер занят");
		};
	}

	Object.defineProperty(globalThis, "navigator", {
		value: { clipboard },
		configurable: true
	});

	return calls;
}

function installClipboardItem(): void {
	Object.defineProperty(globalThis, "ClipboardItem", {
		value: FakeClipboardItem,
		configurable: true
	});
}

function assertCallTypes(calls: Call[], expected: Call["type"][]): void {
	assert.deepEqual(calls.map((call) => call.type), expected);
}

function writeCall(calls: Call[], index: number): FakeClipboardItem {
	const call = calls[index];
	assert.ok(call);
	assert.equal(call.type, "write");
	if (call.type !== "write") throw new Error("ожидался write");
	const item = call.items[0];
	assert.ok(item);
	return item;
}

function textCall(calls: Call[], index: number): string {
	const call = calls[index];
	assert.ok(call);
	assert.equal(call.type, "writeText");
	if (call.type !== "writeText") throw new Error("ожидался writeText");
	return call.text;
}

async function blobText(blob: Blob | undefined): Promise<string> {
	assert.ok(blob);
	return blob.text();
}

test("html пишется rich-вставкой с text/html и text/plain", async () => {
	const calls = installClipboard();
	installClipboardItem();

	await writePayload({ html: "<h3>Глава</h3>", plain: "Глава" });

	assertCallTypes(calls, ["write"]);
	const item = writeCall(calls, 0);
	assert.equal(item.items["text/html"]?.type, "text/html");
	assert.equal(await blobText(item.items["text/html"]), "<h3>Глава</h3>");
	assert.equal(item.items["text/plain"]?.type, "text/plain");
	assert.equal(await blobText(item.items["text/plain"]), "Глава");
});

test("без html пишется только plain", async () => {
	const calls = installClipboard();
	installClipboardItem();

	await writePayload({ plain: "Текст статьи" });

	assertCallTypes(calls, ["writeText"]);
	assert.equal(textCall(calls, 0), "Текст статьи");
});

test("сбой rich-вставки откатывается на plain без исключения", async () => {
	const calls = installClipboard({ failWrite: true });
	installClipboardItem();
	Object.defineProperty(console, "error", { value: () => {}, configurable: true, writable: true });

	await writePayload({ html: "<p>Текст</p>", plain: "Текст" });

	assertCallTypes(calls, ["write", "writeText"]);
	assert.equal(textCall(calls, 1), "Текст");
});

test("без ClipboardItem пишется plain", async () => {
	const calls = installClipboard();
	assert.equal(typeof globalThis.ClipboardItem, "undefined");

	await writePayload({ html: "<p>Текст</p>", plain: "Текст" });

	assertCallTypes(calls, ["writeText"]);
	assert.equal(textCall(calls, 0), "Текст");
});

test("без clipboard.write пишется plain", async () => {
	const calls = installClipboard({ richWrite: false });
	installClipboardItem();

	await writePayload({ html: "<p>Текст</p>", plain: "Текст" });

	assertCallTypes(calls, ["writeText"]);
});

test("сбой plain-записи доходит до обвязки", async () => {
	const calls = installClipboard({ failText: true });
	installClipboardItem();

	await assert.rejects(writePayload({ plain: "Текст" }), /буфер недоступен/);
	assertCallTypes(calls, ["writeText"]);
});
