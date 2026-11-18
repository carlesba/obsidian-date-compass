export function moveEntry(entries: unknown[], from: number, to: number): void {
	entries.splice(to, 0, ...entries.splice(from, 1));
}

export function freeId(entries: readonly { id: string }[], prefix: string): string {
	for (let number = 1; ; number++) {
		const id = `${prefix}-${number}`;
		if (!entries.some((entry) => entry.id === id)) return id;
	}
}

export function uniqueId(stored: unknown, earlier: readonly { id: string }[], prefix: string): string {
	const id = typeof stored === "string" ? stored.trim() : "";
	if (id !== "" && !id.includes("/") && !earlier.some((entry) => entry.id === id)) return id;
	return freeId(earlier, prefix);
}
