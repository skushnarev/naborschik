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

const versions = [
	["package.json", pkg.version],
	["package-lock.json", lock.version],
	['package-lock.json packages[""].version', lock.packages?.[""]?.version],
	["manifest.json", manifest.version]
];

const errors = [];

for (const [name, version] of versions) {
	if (typeof version !== "string" || !semver.test(version)) {
		errors.push(`${name}: ожидается версия вида 0.1.5, получено ${JSON.stringify(version)}`);
	}
}

const unique = [...new Set(versions.map(([, version]) => version))];

if (unique.length > 1) {
	const found = versions.map(([name, version]) => `${name} ${JSON.stringify(version)}`).join(", ");
	errors.push(`Версии расходятся: ${found}`);
}

if (tag !== undefined) {
	if (!semver.test(tag)) {
		errors.push(`Тег ${JSON.stringify(tag)} не похож на 0.1.5: префикс v и суффиксы не поддерживаются`);
	} else if (tag !== manifest.version) {
		errors.push(`Тег ${tag} не совпадает с версией плагина ${manifest.version}`);
	}
}

if (errors.length > 0) {
	for (const error of errors) console.error(`ERROR: ${error}`);
	process.exit(1);
}

console.log(tag === undefined ? `Версия согласована: ${unique[0]}` : `Версия и тег согласованы: ${unique[0]}`);
