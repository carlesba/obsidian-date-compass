import { linkTarget } from "../actions/frontmatter.ts";

const LINK_START = /^\s*(\[\[|\[[^\]]*\]\()/;

function identityOf(item: unknown): string {
	if (typeof item !== "string") return JSON.stringify(item);
	return LINK_START.test(item) ? `link:${linkTarget(item)}` : `text:${item}`;
}

export function propertyWithLinks(existing: unknown, links: readonly string[]): unknown[] | undefined {
	const items: unknown[] = existing === undefined || existing === null || existing === "" ? [] : Array.isArray(existing) ? (existing as unknown[]).slice() : [existing];
	const present = new Set(items.map(identityOf));
	const missing = links.filter((link) => {
		if (present.has(identityOf(link))) return false;
		present.add(identityOf(link));
		return true;
	});
	return missing.length === 0 ? undefined : [...items, ...missing];
}
