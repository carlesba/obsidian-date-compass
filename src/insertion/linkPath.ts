export const LINK_PATHS = ["shortestWhenSafe", "name", "fullPath"] as const;
export type LinkPath = (typeof LINK_PATHS)[number];

export type LinkTarget = "obsidian" | "name" | "fullPath";

export interface NoteLinkFacts {
	exists: boolean;
	shortestLinks: boolean;
	nameTaken: boolean;
	createdInItsFolder: boolean;
}

export function linkTarget(linkPath: LinkPath, facts: () => NoteLinkFacts): LinkTarget {
	if (linkPath !== "shortestWhenSafe") return linkPath;
	const { exists, shortestLinks, nameTaken, createdInItsFolder } = facts();
	return !exists && shortestLinks && !nameTaken && createdInItsFolder ? "name" : "obsidian";
}

export function linktextOf(target: Exclude<LinkTarget, "obsidian">, note: { name: string; path: string }): string {
	return target === "name" ? note.name : note.path.replace(/\.md$/, "");
}

export function wikilink(linktext: string, alias: string | undefined): string {
	return alias && alias.toLowerCase() !== linktext.toLowerCase() ? `[[${linktext}|${alias}]]` : `[[${linktext}]]`;
}

export function markdownLink(linktext: string, label: string): string {
	const destination = Array.from(`${linktext}.md`, (character) => (needsEncoding(character) ? encodeURIComponent(character) : character)).join("");
	return `[${label}](${destination})`;
}

function needsEncoding(character: string): boolean {
	const code = character.charCodeAt(0);
	return character === " " || character === "\\" || code === 0x00 || code === 0x08 || code === 0x0b || code === 0x0c || (code >= 0x0e && code <= 0x1f);
}

export function parentFolder(path: string): string {
	const slash = path.lastIndexOf("/");
	return slash === -1 ? "" : path.slice(0, slash);
}
