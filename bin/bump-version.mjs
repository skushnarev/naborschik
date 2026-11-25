import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Поднимает патч-версию плагина в package.json, package-lock.json и
 * manifest.json. Минор и мажор меняются вручную ближе к релизу.
 */
const root = process.cwd();
const packagePath = join(root, "package.json");
const lockPath = join(root, "package-lock.json");
const manifestPath = join(root, "manifest.json");

const pkg = JSON.parse(readFileSync(packagePath, "utf8"));
const current = String(pkg.version ?? "");
const match = current.match(/^(\d+)\.(\d+)\.(\d+)$/);
if (!match) throw new Error("Не разобрать версию: " + current);

const next = `${match[1]}.${match[2]}.${Number(match[3]) + 1}`;

pkg.version = next;
writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + "\n");

const lock = JSON.parse(readFileSync(lockPath, "utf8"));
lock.version = next;
if (lock.packages?.[""]) lock.packages[""].version = next;
writeFileSync(lockPath, JSON.stringify(lock, null, 2) + "\n");

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
manifest.version = next;
writeFileSync(manifestPath, JSON.stringify(manifest, null, "\t") + "\n");

console.log(`Версия плагина: ${current} -> ${next}`);
