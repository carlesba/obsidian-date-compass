import { linkTarget } from "../actions/frontmatter.ts";

function identityOf(item: unknown): string {
	return typeof item === "string" ? linkTarget(item) : JSON.stringify(item);
}

export function propertyWithLinks(existing: unknown, links: readonly string[]): unknown[] {
	const kept: unknown[] = existing === undefined || existing === null || existing === "" ? [] : Array.isArray(existing) ? (existing as unknown[]).slice() : [existing];
	const present = new Set(kept.map(identityOf));
	for (const link of links) {
		if (present.has(identityOf(link))) continue;
		present.add(identityOf(link));
		kept.push(link);
	}
	return kept;
}
