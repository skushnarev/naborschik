export type Document = {
	blocks: Block[];
	warnings: Warning[];
};

export type WarningCode = "image-unresolved" | "table-degraded" | "code-degraded";

export type Warning = {
	code: WarningCode;
	message: string;
};

export type Block =
	| { type: "header"; level: 2 | 3; text: string }
	| { type: "text"; html: string; text: string }
	| { type: "list"; ordered: boolean; items: ListItem[] }
	| { type: "quote"; html: string; text: string }
	| { type: "code"; text: string; lang: string }
	| { type: "table"; headers: string[]; rows: string[][]; align: Array<"left" | "center" | "right" | null>; raw: string }
	| { type: "image"; src: string; alt: string; width: number | null; raw: string }
	| { type: "delimiter" };

export type ListItem = {
	html: string;
	text: string;
};

export type ClipboardPayload = {
	plain: string;
	html?: string;
};

export type ConvertContext = {
	warnings: Warning[];
	images?: ImageResolver;
};

export type ImageResolver = (name: string) => { src: string; width: number | null } | null;

export interface PlatformAdapter {
	id: string;
	title: string;
	/** Форма для фраз «Копировать для ...» и уведомления. */
	forWhom: string;
	icon: string;
	convert(doc: Document, ctx: ConvertContext): Promise<ClipboardPayload>;
}
