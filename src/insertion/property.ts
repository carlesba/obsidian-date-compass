const WIKILINK = /^\[\[([^\]|#]+)/;

const MARKDOWN_LINK = /^\[[^\]]*\]\(<?([^)>]+)>?\)/;

export function linkTarget(text: string): string {
	const trimmed = text.trim();
	const wikilink = WIKILINK.exec(trimmed);
	if (wikilink) return wikilink[1].trim();
	const markdown = MARKDOWN_LINK.exec(trimmed);
	if (markdown) return safeDecode(markdown[1].trim());
	return trimmed;
}

function safeDecode(text: string): string {
	try {
		return decodeURI(text);
	} catch {
		return text;
	}
}

const LINK_START = /^\s*(\[\[|\[[^\]]*\]\()/;

function identityOf(item: unknown): string {
	if (typeof item !== "string") return JSON.stringify(item);
	return LINK_START.test(item) ? `link:${linkTarget(item)}` : `text:${item}`;
}

export function propertyWithLinks(existing: unknown, links: readonly string[]): unknown[] | undefined {
	const items: unknown[] = existing === undefined || existing === null || existing === "" ? [] : Array.isArray(existing) ? (existing as unknown[]).filter((item) => item !== null && item !== undefined) : [existing];
	const present = new Set(items.map(identityOf));
	const missing = links.filter((link) => {
		if (present.has(identityOf(link))) return false;
		present.add(identityOf(link));
		return true;
	});
	return missing.length === 0 ? undefined : [...items, ...missing];
}
