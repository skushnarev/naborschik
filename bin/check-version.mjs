import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Сверяет версию плагина в package.json, package-lock.json и manifest.json.
 * Необязательный аргумент это тег релиза: он должен совпадать с версией
 * без префикса `v`.
 *
 * Запуск: node bin/check-version.mjs [0.1.5]
 */
const root = process.cwd();
const tag = process.argv[2];
const semver = /^\d+\.\d+\.\d+$/;

function readJson(name) {
	return JSON.parse(readFileSync(join(root, name), "utf8"));
}

const pkg = readJson("package.json");
const lock = readJson("package-lock.json");
const manifest = readJson("manifest.json");

const sources = [
	["package.json", pkg.version],
	["package-lock.json", lock.version],
	['package-lock.json packages[""].version', lock.packages?.[""]?.version],
	["manifest.json", manifest.version]
];

const errors = [];
const declared = [];

for (const [name, version] of sources) {
	if (typeof version !== "string" || !semver.test(version)) {
		errors.push(`${name}: ожидается версия вида 0.1.5, получено ${JSON.stringify(version)}`);
		continue;
	}
	declared.push(version);
}

const agreed = declared.length === sources.length && new Set(declared).size === 1;

if (declared.length === sources.length && !agreed) {
	const found = sources.map(([name, version]) => `${name} ${JSON.stringify(version)}`).join(", ");
	errors.push(`Версии расходятся: ${found}`);
}

if (tag !== undefined) {
	if (!semver.test(tag)) {
		errors.push(`Тег ${JSON.stringify(tag)} не похож на 0.1.5: префикс v и суффиксы не поддерживаются`);
	} else if (agreed && tag !== declared[0]) {
		errors.push(`Тег ${tag} не совпадает с версией плагина ${declared[0]}`);
	}
}

if (errors.length > 0) {
	for (const error of errors) console.error(`ERROR: ${error}`);
	process.exit(1);
}

console.log(tag === undefined ? `Версия согласована: ${declared[0]}` : `Версия и тег согласованы: ${declared[0]}`);
