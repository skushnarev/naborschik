import { strict as assert } from "node:assert";
import { test } from "node:test";
import type { App } from "obsidian";
import { loadImageResolver } from "../src/plugin/images.ts";
import { STAR, STAR_SRC } from "./support/star.ts";

type FakeFile = { path: string; extension: string; bytes: Uint8Array };

function file(path: string): FakeFile {
	return { path, extension: path.split(".").pop() ?? "", bytes: STAR };
}

function fakeApp(
	files: FakeFile[],
	links: Record<string, string> = {},
	folders: string[] = [],
	failRead = false
): App {
	const byPath = new Map(files.map((item) => [item.path, item]));

	const app = {
		vault: {
			async readBinary(item: FakeFile) {
				if (failRead) throw new Error("нет доступа");
				return item.bytes.buffer as ArrayBuffer;
			}
		},
		metadataCache: {
			getFirstLinkpathDest(linkpath: string) {
				const path = links[linkpath];
				if (!path) return null;
				return byPath.get(path) ?? (folders.includes(path) ? { path } : null);
			}
		}
	};

	return app as unknown as App;
}

test("резолвер обвязки находит файл по полному пути", async () => {
	const app = fakeApp([file("media/star.png")], { "media/star.png": "media/star.png" });
	const resolver = await loadImageResolver(app, "![[media/star.png|64]]", "notes/article.md");

	assert.deepEqual(resolver("media/star.png"), { src: STAR_SRC, width: 16 });
});

test("резолвер обвязки ищет файл по имени как вики-ссылку", async () => {
	const app = fakeApp([file("media/star.png")], { "star.png": "media/star.png" });
	const resolver = await loadImageResolver(app, "![[star.png]]", "notes/article.md");

	assert.deepEqual(resolver("star.png"), { src: STAR_SRC, width: 16 });
});

test("вставка заметки не читается как картинка", async () => {
	const app = fakeApp([file("media/star.png")], { "Заметка": "media/star.png" });
	const resolver = await loadImageResolver(app, "![[Заметка]]", "notes/article.md");

	assert.equal(resolver("Заметка"), null);
});

test("сбой чтения не роняет копирование и оставляет картинку без резолвера", async () => {
	const app = fakeApp([file("media/star.png")], { "media/star.png": "media/star.png" }, [], true);

	const warn = console.warn;
	console.warn = () => undefined;
	try {
		const resolver = await loadImageResolver(app, "![[media/star.png]]", "notes/article.md");
		assert.equal(resolver("media/star.png"), null);
	} finally {
		console.warn = warn;
	}
});

test("папка не считается файлом картинки", async () => {
	const app = fakeApp([], { "star.png": "media" }, ["media"]);
	const resolver = await loadImageResolver(app, "![[star.png]]", "notes/article.md");

	assert.equal(resolver("star.png"), null);
});
