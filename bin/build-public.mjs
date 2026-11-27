#!/usr/bin/env node
// Собирает веб-версию конвертера в один самодостаточный public/index.html.
//
// Запуск: node bin/build-public.mjs [папка]
// По умолчанию пишет в public/. Скрипты и стили встраиваются в HTML.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import esbuild from "esbuild";

const root = resolve(import.meta.dirname, "..");
const outDir = resolve(process.argv[2] ?? join(root, "public"));

const template = await readFile(join(root, "web", "index.html"), "utf8");
const styles = await readFile(join(root, "web", "styles.css"), "utf8");

if (!template.includes("/*__STYLES__*/") || !template.includes("/*__SCRIPT__*/")) {
	throw new Error("В web/index.html нет меток для стилей и скрипта");
}

const result = await esbuild.build({
	entryPoints: [join(root, "web", "main.ts")],
	bundle: true,
	format: "iife",
	platform: "browser",
	target: "es2018",
	charset: "utf8",
	minify: true,
	legalComments: "none",
	write: false,
	logLevel: "info"
});

const script = result.outputFiles?.[0]?.text ?? "";
if (!script) throw new Error("esbuild не вернул бандл");

const html = template
	.replace("/*__STYLES__*/", () => styles)
	.replace("/*__SCRIPT__*/", () => script.replace(/<\/script/gi, "<\\/script"));

await mkdir(outDir, { recursive: true });
const target = join(outDir, "index.html");
await writeFile(target, html);
console.log("Страница: " + target);
