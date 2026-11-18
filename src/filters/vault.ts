export interface VaultNote {
	path: string;
	basename: string;
	ctime: number;
}

export type Frontmatter = Readonly<Record<string, unknown>>;

export interface MomentDate {
	clone(): MomentDate;
	add(amount: number, unit: "day"): MomentDate;
	format(format?: string): string;
}

export type MomentFactory = (input?: number) => MomentDate;

export interface FilterVault {
	notes(): VaultNote[];
	frontmatter(path: string): Frontmatter | undefined;
	tags(path: string): string[];
	linksFrom(path: string): string[];
	linksTo(path: string): string[];
	embeds(path: string): string[];
	size(path: string): number;
	mtime(path: string): number;
	moment: MomentFactory;
}

export function findNote(notes: readonly VaultNote[], note: string): VaultNote | undefined {
	return (
		notes.find((candidate) => candidate.path === note) ??
		notes.find((candidate) => candidate.path === `${note}.md`) ??
		notes.find((candidate) => candidate.basename === note)
	);
}
