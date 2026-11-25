import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const ROOTS = ["src/core", "src/platforms"];
const FORBIDDEN = /(?:from\s*|import\s*\(\s*|import\s+|require\(\s*)["']obsidian["']/;
const EXTENSIONS = [".ts", ".mts", ".js", ".mjs"];

function walk(directory) {
	const entries = readdirSync(directory, { withFileTypes: true });
	const files = [];

	for (const entry of entries) {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) {
			files.push(...walk(path));
		} else if (EXTENSIONS.some((extension) => entry.name.endsWith(extension))) {
			files.push(path);
		}
	}

	return files;
}

const failures = [];

for (const root of ROOTS) {
	let files;
	try {
		files = walk(root);
	} catch (error) {
		if (error.code === "ENOENT") continue;
		throw error;
	}

	for (const file of files) {
		const source = readFileSync(file, "utf8");
		if (FORBIDDEN.test(source)) {
			failures.push(relative(process.cwd(), file));
		}
	}
}

if (failures.length) {
	console.error("Ядро импортирует obsidian:");
	for (const file of failures) console.error("  " + file);
	process.exit(1);
}

console.log("Ядро чистое: obsidian не импортируется.");
