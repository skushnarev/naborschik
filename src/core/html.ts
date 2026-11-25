export function escapeHtml(value: string): string {
	return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function escapeAttr(value: string): string {
	return escapeHtml(value).replace(/"/g, "&quot;");
}

export function decodeEntities(value: string): string {
	return String(value).replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity: string) => {
		if (entity === "amp") return "&";
		if (entity === "lt") return "<";
		if (entity === "gt") return ">";
		if (entity === "quot") return '"';
		if (entity === "apos") return "'";
		if (entity === "nbsp") return "\u00A0";
		if (entity.startsWith("#")) {
			const code = entity.charAt(1).toLowerCase() === "x"
				? Number.parseInt(entity.slice(2), 16)
				: Number.parseInt(entity.slice(1), 10);
			return Number.isFinite(code) ? String.fromCodePoint(code) : match;
		}
		return match;
	});
}

export function htmlToText(html: string): string {
	return decodeEntities(
		String(html)
			.replace(/<br\s*\/?>/gi, "\n")
			.replace(/<\/p>\s*<p>/gi, "\n")
			.replace(/<[^>]+>/g, "")
	);
}

export function stripTags(html: string): string {
	return htmlToText(html).trim();
}
