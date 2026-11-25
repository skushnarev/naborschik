const LANG_ALIASES: Record<string, string> = {
	js: "javascript",
	jsx: "javascript",
	ts: "typescript",
	tsx: "typescript",
	py: "python",
	sh: "bash",
	shell: "bash",
	zsh: "bash",
	yml: "yaml",
	md: "markdown",
	text: "",
	txt: ""
};

export function normalizeLang(lang: string | undefined): string {
	const value = String(lang ?? "").trim().toLowerCase().split(/\s+/)[0] ?? "";
	if (!value) return "";
	return Object.hasOwn(LANG_ALIASES, value) ? LANG_ALIASES[value]! : value;
}
