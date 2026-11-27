import { hasFrontmatter } from "../src/core/parse.ts";
import { PLATFORMS } from "../src/platforms/index.ts";
import type { Block, ImageResolver, PlatformAdapter, Warning } from "../src/core/types.ts";
import { convertMarkdown, type Conversion, type PlatformOutput } from "./convert.ts";
import {
	createImageEntry,
	createImageResolver,
	mergeImageEntries,
	normalizeImagePath,
	summarizeImages,
	type ImageEntry
} from "./images.ts";
import { sampleImageEntry } from "./sample.ts";

type Tab = "blocks" | "payload";

type State = {
	conversion: Conversion | null;
	images: ImageEntry[];
	platform: string;
	tab: Tab;
	error: string;
};

const SAMPLE = [
	"---",
	"title: Пример статьи",
	"---",
	"",
	"# Заголовок статьи в буфер не входит",
	"",
	"Вступление с **жирным**, *курсивом*, `кодом` и [ссылкой](https://ya.ru). Символы & < > остаются текстом.",
	"",
	"## Глава 1",
	"",
	"> [!note] Важно",
	"> Callout станет цитатой, маркер уберётся, заголовок останется жирным.",
	"",
	"- Первый пункт",
	"- Второй пункт",
	"  - Вложенный пункт",
	"- [x] Готово",
	"- [ ] Не готово",
	"",
	"1. Первый",
	"2. Второй",
	"",
	"> Обычная цитата.",
	"",
	"---",
	"",
	"### Раздел",
	"",
	"| Колонка | Значение |",
	"|---|---|",
	"| A | 1 |",
	"| B | 2 |",
	"",
	"~~~js",
	"const x = 1;",
	"console.log(x);",
	"~~~",
	"",
	"Ссылка на [[Папку/Заметку|алиас]].",
	"",
	"![[star.png|64]]"
].join("\n");

function byId<T extends HTMLElement>(id: string): T {
	const element = document.getElementById(id);
	if (!element) throw new Error("Нет элемента #" + id);
	return element as T;
}

const input = byId<HTMLTextAreaElement>("input");
const statsEl = byId<HTMLElement>("stats");
const noticeEl = byId<HTMLElement>("notice");
const blocksPanel = byId<HTMLElement>("panel-blocks");
const payloadPanel = byId<HTMLElement>("panel-payload");
const payloadEl = byId<HTMLElement>("payload");
const countBadge = byId<HTMLElement>("count-badge");
const platformsNav = byId<HTMLElement>("platforms");
const copyButton = byId<HTMLButtonElement>("copy");
const fileInput = byId<HTMLInputElement>("file");
const hintEl = byId<HTMLElement>("hint");
const toastEl = byId<HTMLElement>("toast");
const pageEl = document.querySelector<HTMLElement>(".page");
const imageFilesInput = byId<HTMLInputElement>("image-files");
const imageFolderInput = byId<HTMLInputElement>("image-folder");
const imageChipsEl = byId<HTMLElement>("image-chips");
const imageSummaryEl = byId<HTMLElement>("image-summary");
const imageNotesEl = byId<HTMLElement>("image-notes");

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

const state: State = {
	conversion: null,
	images: [sampleImageEntry()],
	platform: PLATFORMS[0]?.id ?? "",
	tab: "blocks",
	error: ""
};

let generation = 0;
let toastTimer = 0;
const resolvers = new WeakMap<ImageEntry[], ImageResolver>();

for (const adapter of PLATFORMS) {
	const button = document.createElement("button");
	button.type = "button";
	button.dataset.platform = adapter.id;
	button.textContent = adapter.title;
	button.addEventListener("click", () => {
		state.platform = adapter.id;
		render();
	});
	platformsNav.appendChild(button);
}

for (const button of document.querySelectorAll<HTMLButtonElement>("[data-tab]")) {
	button.addEventListener("click", () => {
		const tab = button.dataset.tab;
		if (tab === "blocks" || tab === "payload") setTab(tab);
	});
}

async function convert(): Promise<void> {
	const current = ++generation;

	try {
		const conversion = await convertMarkdown(input.value, resolverFor(state.images));
		if (current !== generation) return;
		state.conversion = conversion;
		state.error = "";
	} catch (error) {
		if (current !== generation) return;
		state.conversion = null;
		state.error = error instanceof Error ? error.message : String(error);
	}

	if (current !== generation) return;
	render();
}

function selectedAdapter(): PlatformAdapter | null {
	return PLATFORMS.find((adapter) => adapter.id === state.platform) ?? null;
}

function selectedOutput(): PlatformOutput | null {
	return state.conversion?.outputs[state.platform] ?? null;
}

function selectedText(): string {
	const payload = selectedOutput()?.payload;
	return payload ? payload.html ?? payload.plain : "";
}

function render(): void {
	const blocks = state.conversion?.blocks ?? [];
	const output = selectedOutput();
	const adapter = selectedAdapter();
	const text = selectedText();
	const warnings = output?.warnings ?? [];

	countBadge.textContent = String(blocks.length);
	payloadEl.textContent = text;
	copyButton.disabled = !text;
	copyButton.textContent = copyLabel(adapter);

	renderStats(blocks, text, adapter, warnings.length);
	renderNotice(blocks, text, adapter, warnings);
	renderPlatforms();
	renderBlocks(blocks);
	renderImages();
	setTab(state.tab);
	hintEl.textContent = hintFor(adapter);
}

function renderStats(
	blocks: Block[],
	text: string,
	adapter: PlatformAdapter | null,
	warningCount: number
): void {
	statsEl.innerHTML = "";
	statsEl.appendChild(pill(blocks.length + " блоков"));
	statsEl.appendChild(pill(text.length + " символов"));

	if (adapter?.id === "vcru" && blocks.length > 0) {
		const mode = blocks.length === 1 ? "plain: один блок" : "tool: много блоков";
		statsEl.appendChild(pill(mode, blocks.length === 1 ? "warn" : "ok"));
	} else if (adapter) {
		statsEl.appendChild(pill("HTML: " + adapter.title, "ok"));
	}

	if (hasFrontmatter(input.value)) statsEl.appendChild(pill("frontmatter вырезан"));
	if (warningCount > 0) statsEl.appendChild(pill("предупреждений: " + warningCount, "warn"));
	if (state.error) statsEl.appendChild(pill("ошибка", "fail"));
}

function renderNotice(
	blocks: Block[],
	text: string,
	adapter: PlatformAdapter | null,
	warnings: Warning[]
): void {
	const messages: string[] = [];

	if (state.error) messages.push("Ошибка конвертера: " + state.error);
	if (blocks.length === 0) {
		messages.push("Блоков нет. Проверь, что вставился Markdown, а не пустой текст.");
	}
	if (hasFrontmatter(input.value)) {
		messages.push("Frontmatter в начале вырезан: в статью он не попадает.");
	}
	if (adapter?.id === "vcru" && blocks.length === 1) {
		messages.push(
			"Один блок уйдёт обычным текстом. vc.ru не создаёт нативный блок из одиночной строки [tool:...]."
		);
	}
	for (const warning of warnings) messages.push(warning.message);
	if (text.includes("[[")) {
		messages.push("В выходе остались Obsidian-ссылки или картинки. Найди их поиском по [[ и замени руками.");
	}
	if (adapter && adapter.id !== "vcru" && text.includes("<img")) {
		messages.push("В выходе есть img. Проверь, не вырезал ли картинку редактор площадки.");
	}

	const unique = [...new Set(messages)];
	noticeEl.hidden = unique.length === 0;
	noticeEl.textContent = unique.join(" ");
}

function renderImages(): void {
	const summary = summarizeImages(state.images, input.value);
	const total = formatBytes(summary.totalSize);

	if (summary.targets.length > 0) {
		imageSummaryEl.textContent = "сопоставлено " + summary.matched + " из " + summary.targets.length + " · " + total;
	} else if (state.images.length > 0) {
		imageSummaryEl.textContent = state.images.length + " " + fileWord(state.images.length) + " · " + total;
	} else {
		imageSummaryEl.textContent = "файлы не выбраны, перетащи их на страницу";
	}

	imageChipsEl.innerHTML = "";
	for (const entry of state.images) {
		const chip = document.createElement("span");
		chip.className = "chip" + (entry.sample ? " chip-sample" : "");
		chip.title = entry.path + (entry.sample ? " (из примера)" : "");

		const name = document.createElement("span");
		name.className = "chip-name";
		name.textContent = entry.name;

		const size = document.createElement("span");
		size.className = "chip-size";
		size.textContent = formatBytes(entry.size);

		const remove = document.createElement("button");
		remove.type = "button";
		remove.className = "chip-remove";
		remove.textContent = "×";
		remove.setAttribute("aria-label", "Убрать " + entry.name);
		remove.addEventListener("click", () => {
			state.images = state.images.filter((item) => item !== entry);
			void convert();
		});

		chip.append(name, size, remove);
		imageChipsEl.appendChild(chip);
	}

	const notes: Array<{ text: string; warn?: boolean }> = [];

	if (summary.unmatched.length > 0) {
		notes.push({ text: "Не найдены: " + summary.unmatched.join(", ") });
	}
	if (summary.ambiguous.length > 0) {
		notes.push({
			text:
				"Файлы с именем " +
				summary.ambiguous.join(", ") +
				": по имени не подставляются, укажи папку в ![[...]] или удали лишний.",
			warn: true
		});
	}
	if (summary.totalSize > MAX_IMAGE_BYTES) {
		notes.push({
			text: "Картинки весят больше 20 МБ: страница может тормозить, сжатие появится позже.",
			warn: true
		});
	}

	imageNotesEl.innerHTML = "";
	for (const note of notes) {
		const line = document.createElement("p");
		line.className = "image-note" + (note.warn ? " warn" : "");
		line.textContent = note.text;
		imageNotesEl.appendChild(line);
	}
	imageNotesEl.hidden = notes.length === 0;
}

function formatBytes(size: number): string {
	if (size < 1024) return size + " Б";
	if (size < 1024 * 1024) return (size / 1024).toFixed(1).replace(".", ",") + " КБ";
	return (size / (1024 * 1024)).toFixed(1).replace(".", ",") + " МБ";
}

function fileWord(count: number): string {
	const mod10 = count % 10;
	const mod100 = count % 100;
	if (mod10 === 1 && mod100 !== 11) return "файл";
	if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "файла";
	return "файлов";
}

async function addImageFiles(files: File[]): Promise<void> {
	if (files.length === 0) return;

	const created: ImageEntry[] = [];
	const rejected: string[] = [];

	for (const file of files) {
		const path = file.webkitRelativePath || file.name;

		try {
			const entry = createImageEntry(path, new Uint8Array(await file.arrayBuffer()));
			if (entry) created.push(entry);
			else rejected.push(file.name);
		} catch {
			rejected.push(file.name);
		}
	}

	if (created.length > 0) {
		state.images = mergeImageEntries(state.images, created);
		void convert();
	}

	const messages: string[] = [];
	if (created.length > 0) messages.push("Добавлено картинок: " + created.length);
	if (rejected.length > 0) messages.push("Пропущены: " + rejected.join(", "));
	toast(messages.join(". ") || "Картинки не выбраны");
}

function resolverFor(entries: ImageEntry[]): ImageResolver {
	let resolver = resolvers.get(entries);
	if (!resolver) {
		resolver = createImageResolver(entries);
		resolvers.set(entries, resolver);
	}
	return resolver;
}

function withSampleImage(entries: ImageEntry[]): ImageEntry[] {
	if (entries.some((entry) => normalizeImagePath(entry.name) === "star.png")) return entries;
	return [...entries, sampleImageEntry()];
}

function renderPlatforms(): void {
	for (const button of document.querySelectorAll<HTMLButtonElement>("[data-platform]")) {
		const active = button.dataset.platform === state.platform;
		button.classList.toggle("active", active);
		button.setAttribute("aria-pressed", String(active));
	}
}

function renderBlocks(blocks: Block[]): void {
	blocksPanel.innerHTML = "";

	if (blocks.length === 0) {
		const empty = document.createElement("div");
		empty.className = "empty";
		empty.textContent = "Пока пусто. Вставь Markdown слева или нажми «Пример».";
		blocksPanel.appendChild(empty);
		return;
	}

	blocks.forEach((block, index) => {
		const card = document.createElement("article");
		card.className = "block-card";

		const head = document.createElement("div");
		head.className = "block-head";

		const badge = document.createElement("span");
		badge.className = "badge badge-" + block.type;
		badge.textContent = labelFor(block);
		head.appendChild(badge);

		const number = document.createElement("span");
		number.className = "block-number";
		number.textContent = "#" + (index + 1);
		head.appendChild(number);

		card.appendChild(head);

		const body = document.createElement("div");
		body.className = "block-body";
		fillPreview(body, block);
		card.appendChild(body);

		blocksPanel.appendChild(card);
	});
}

function fillPreview(container: HTMLElement, block: Block): void {
	switch (block.type) {
		case "header": {
			const heading = document.createElement(block.level === 3 ? "h3" : "h2");
			heading.textContent = block.text;
			container.appendChild(heading);
			return;
		}
		case "text":
			container.innerHTML = block.html;
			return;
		case "list": {
			const list = document.createElement(block.ordered ? "ol" : "ul");
			for (const item of block.items) {
				const li = document.createElement("li");
				li.innerHTML = item.html;
				list.appendChild(li);
			}
			container.appendChild(list);
			return;
		}
		case "quote": {
			const quote = document.createElement("blockquote");
			quote.innerHTML = block.html;
			container.appendChild(quote);
			return;
		}
		case "code": {
			const pre = document.createElement("pre");
			pre.className = "code-preview";
			const code = document.createElement("code");
			code.textContent = block.text;
			pre.appendChild(code);
			container.appendChild(pre);
			return;
		}
		case "table": {
			const table = document.createElement("table");
			const thead = document.createElement("thead");
			const headRow = document.createElement("tr");

			block.headers.forEach((header, index) => {
				const th = document.createElement("th");
				th.innerHTML = header;
				const align = block.align[index] ?? null;
				if (align) th.style.textAlign = align;
				headRow.appendChild(th);
			});

			thead.appendChild(headRow);
			table.appendChild(thead);

			if (block.rows.length > 0) {
				const tbody = document.createElement("tbody");
				for (const row of block.rows) {
					const tr = document.createElement("tr");
					row.forEach((cell, index) => {
						const td = document.createElement("td");
						td.innerHTML = cell;
						const align = block.align[index] ?? null;
						if (align) td.style.textAlign = align;
						tr.appendChild(td);
					});
					tbody.appendChild(tr);
				}
				table.appendChild(tbody);
			}

			container.appendChild(table);
			return;
		}
		case "image": {
			const image = document.createElement("img");
			image.className = "image-preview";
			image.src = block.src;
			image.alt = block.alt;
			if (block.width) image.width = block.width;
			container.appendChild(image);
			return;
		}
		case "delimiter":
			container.appendChild(document.createElement("hr"));
			return;
	}
}

function labelFor(block: Block): string {
	switch (block.type) {
		case "header":
			return "header h" + block.level;
		case "text":
			return "text";
		case "list":
			return "list " + (block.ordered ? "ol" : "ul");
		case "quote":
			return "quote";
		case "code":
			return block.lang ? "code " + block.lang : "code";
		case "table":
			return "table";
		case "image":
			return "image";
		case "delimiter":
			return "delimiter";
	}
}

function setTab(tab: Tab): void {
	state.tab = tab;

	for (const button of document.querySelectorAll<HTMLButtonElement>("[data-tab]")) {
		const active = button.dataset.tab === tab;
		button.classList.toggle("active", active);
		button.setAttribute("aria-selected", String(active));
	}

	blocksPanel.classList.toggle("active", tab === "blocks");
	payloadPanel.classList.toggle("active", tab === "payload");
}

function pill(text: string, tone?: "ok" | "warn" | "fail"): HTMLSpanElement {
	const span = document.createElement("span");
	span.className = "pill" + (tone ? " pill-" + tone : "");
	span.textContent = text;
	return span;
}

function copyLabel(adapter: PlatformAdapter | null): string {
	return adapter ? "Скопировать для " + adapter.forWhom : "Скопировать";
}

function hintFor(adapter: PlatformAdapter | null): string {
	if (adapter?.id === "dzen") {
		return "В Дзене вставь HTML в визуальный редактор. Код станет цитатой, таблица списком, разделитель текстом. Проверь блоки в черновике.";
	}
	if (adapter?.id === "smartlab") {
		return "В Смартлабе вставь HTML в визуальный редактор. Код уходит как pre, таблица таблицей. Проверь блоки в черновике.";
	}
	if (adapter?.id === "vcru") {
		return "В черновике vc.ru поставь курсор в пустой текстовый блок и вставь. Один блок уходит обычным текстом. Картинки остаются строками ![[...]] и меняются руками.";
	}
	return "";
}

async function copyOutput(): Promise<void> {
	const payload = selectedOutput()?.payload;
	if (!payload) {
		toast("Нечего копировать");
		return;
	}

	const adapter = selectedAdapter();
	const html = payload.html;
	const richRequested = Boolean(html && adapter?.id !== "vcru");
	const result = richRequested && html ? await copyHtml(html, payload.plain) : await copyText(payload.plain);

	if (!result) {
		setTab("payload");
		toast("Не удалось скопировать автоматически. Текст открыт во вкладке Payload.");
		return;
	}

	copyButton.textContent = "Скопировано";
	if (result === "rich") {
		toast("В буфере HTML для " + (adapter?.title ?? "площадки") + ". Вставь в визуальный редактор и проверь блоки.");
	} else if (richRequested) {
		toast("Rich-вставка недоступна, в буфере читаемый текст без тегов.");
	} else {
		toast("В буфере " + payload.plain.length + " символов. Вставь в нужное поле площадки.");
	}

	window.setTimeout(() => {
		copyButton.textContent = copyLabel(selectedAdapter());
	}, 1600);
}

async function copyText(text: string): Promise<"plain" | false> {
	try {
		if (navigator.clipboard?.writeText) {
			await navigator.clipboard.writeText(text);
			return "plain";
		}
	} catch {
		// Ниже запасной путь через execCommand.
	}

	return fallbackCopy(text) ? "plain" : false;
}

async function copyHtml(html: string, plain: string): Promise<"rich" | "plain" | false> {
	if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
		try {
			const item = new ClipboardItem({
				"text/html": new Blob([html], { type: "text/html" }),
				"text/plain": new Blob([plain], { type: "text/plain" })
			});
			await navigator.clipboard.write([item]);
			return "rich";
		} catch {
			// Ниже пробуем текстовый буфер.
		}
	}

	return copyText(plain);
}

function fallbackCopy(text: string): boolean {
	const area = document.createElement("textarea");
	area.value = text;
	area.setAttribute("readonly", "");
	area.style.position = "fixed";
	area.style.top = "-1000px";
	document.body.appendChild(area);
	area.select();

	let ok = false;
	try {
		ok = document.execCommand("copy");
	} catch {
		ok = false;
	}

	document.body.removeChild(area);
	return ok;
}

function toast(message: string): void {
	toastEl.textContent = message;
	toastEl.classList.add("visible");
	if (toastTimer) window.clearTimeout(toastTimer);
	toastTimer = window.setTimeout(() => {
		toastEl.classList.remove("visible");
	}, 3200);
}

input.addEventListener("input", () => {
	// Своя статья вытесняет режим примера: встроенная картинка не должна
	// подставляться в чужой ![[star.png]].
	if (input.value !== SAMPLE && state.images.some((entry) => entry.sample)) {
		state.images = state.images.filter((entry) => !entry.sample);
	}
	void convert();
});

copyButton.addEventListener("click", () => {
	void copyOutput();
});

document.addEventListener("keydown", (event) => {
	if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
		event.preventDefault();
		void copyOutput();
	}
});

byId<HTMLButtonElement>("load-sample").addEventListener("click", () => {
	input.value = SAMPLE;
	state.images = withSampleImage(state.images);
	void convert();
});

byId<HTMLButtonElement>("clear").addEventListener("click", () => {
	input.value = "";
	state.images = [];
	void convert();
	input.focus();
});

imageFilesInput.addEventListener("change", () => {
	const files = Array.from(imageFilesInput.files ?? []);
	imageFilesInput.value = "";
	void addImageFiles(files);
});

imageFolderInput.addEventListener("change", () => {
	const files = Array.from(imageFolderInput.files ?? []);
	imageFolderInput.value = "";
	void addImageFiles(files);
});

document.addEventListener("dragover", (event) => {
	if (!event.dataTransfer?.types.includes("Files")) return;
	event.preventDefault();
	pageEl?.classList.add("dragging");
});

document.addEventListener("dragleave", (event) => {
	if (event.relatedTarget === null) pageEl?.classList.remove("dragging");
});

document.addEventListener("drop", (event) => {
	if (!event.dataTransfer?.types.includes("Files")) return;
	event.preventDefault();
	pageEl?.classList.remove("dragging");
	void addImageFiles(Array.from(event.dataTransfer.files));
});

fileInput.addEventListener("change", () => {
	const file = fileInput.files?.[0];
	if (!file) return;

	file
		.text()
		.then((text) => {
			input.value = text;
			state.images = state.images.filter((entry) => !entry.sample);
			fileInput.value = "";
			void convert();
			toast("Загружено: " + file.name);
		})
		.catch(() => {
			toast("Не удалось прочитать файл");
		});
});

input.value = SAMPLE;
setTab("blocks");
void convert();
