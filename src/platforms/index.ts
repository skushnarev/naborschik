import type { PlatformAdapter } from "../core/types.ts";
import { dzenAdapter } from "./dzen.ts";
import { vcruAdapter } from "./vcru.ts";

/**
 * Упорядоченный реестр площадок. Меню и палитра строятся из него,
 * поэтому новая площадка это модуль адаптера и строка здесь.
 */
export const PLATFORMS: PlatformAdapter[] = [vcruAdapter, dzenAdapter];
