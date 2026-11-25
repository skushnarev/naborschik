import esbuild from "esbuild";
import { copyFile, mkdir } from "node:fs/promises";

const production = process.argv.includes("production");

await mkdir("dist", { recursive: true });
await copyFile("manifest.json", "dist/manifest.json");

const context = await esbuild.context({
	entryPoints: ["src/main.ts"],
	bundle: true,
	external: ["obsidian", "electron", "@codemirror/*", "@lezer/*"],
	format: "cjs",
	target: "es2018",
	logLevel: "info",
	sourcemap: production ? false : "inline",
	treeShaking: true,
	outfile: "dist/main.js"
});

if (production) {
	await context.rebuild();
	await context.dispose();
} else {
	await context.watch();
	console.log("Сборка в watch: dist/main.js");
}
