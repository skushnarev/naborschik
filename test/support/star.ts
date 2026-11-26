import { readFileSync } from "node:fs";

export const STAR = new Uint8Array(readFileSync(new URL("../fixtures/star.png", import.meta.url)));

export const STAR_SRC =
	"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMUlEQVR42mNgGNTgmZvafxAeogbANBNtCLoGQpgiQ8h2Ddn+p68B2DSQ5X+qJ6rBCwDXyor9t1yssgAAAABJRU5ErkJggg==";
