export type DatesDestination = { kind: "body" } | { kind: "property"; name: string } | { kind: "frontmatterWithoutProperty" };

export interface EditorState {
	lines: readonly string[];
	cursorLine: number;
	focusedProperty: string | undefined;
}

const FRONTMATTER_FENCE = /^---\s*$/;

const PROPERTY_LINE = /^([^\s#:'"-][^:]*|"[^"]+"|'[^']+'):(\s|$)/;

export function frontmatterRange(lines: readonly string[]): { first: number; last: number } | undefined {
	if (lines.length === 0 || !FRONTMATTER_FENCE.test(lines[0])) return undefined;
	const closing = lines.findIndex((line, index) => index > 0 && FRONTMATTER_FENCE.test(line));
	return closing === -1 ? undefined : { first: 1, last: closing - 1 };
}

export function propertyAtLine(lines: readonly string[], cursorLine: number): string | undefined {
	const range = frontmatterRange(lines);
	if (!range || cursorLine < range.first || cursorLine > range.last) return undefined;
	for (let index = cursorLine; index >= range.first; index--) {
		const match = PROPERTY_LINE.exec(lines[index]);
		if (match) return match[1].trim().replace(/^(["'])(.*)\1$/, "$2");
	}
	return undefined;
}

export function chooseDestination({ lines, cursorLine, focusedProperty }: EditorState): DatesDestination {
	if (focusedProperty !== undefined && focusedProperty !== "") return { kind: "property", name: focusedProperty };
	const range = frontmatterRange(lines);
	if (!range || cursorLine < range.first || cursorLine > range.last) return { kind: "body" };
	const name = propertyAtLine(lines, cursorLine);
	return name === undefined ? { kind: "frontmatterWithoutProperty" } : { kind: "property", name };
}
