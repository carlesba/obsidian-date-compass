import type { FilterVault, Frontmatter, VaultNote } from "../src/filters/vault.ts";
import { moment } from "./moment.ts";

export interface FakeNote {
	path: string;
	ctime?: number;
	mtime?: number;
	frontmatter?: Frontmatter;
	tags?: string[];
	links?: string[];
	embeds?: string[];
	size?: number;
}

export const NOW = new Date(2024, 2, 9, 15).getTime();
export const HOURS_AGO = (hours: number) => NOW - hours * 3600 * 1000;

export function noteOf(fake: FakeNote): VaultNote {
	return { path: fake.path, basename: fake.path.split("/").pop()!.replace(/\.md$/, ""), ctime: fake.ctime ?? 0 };
}

export function fakeFilterVault(fakes: FakeNote[]): FilterVault {
	const byPath = (path: string) => fakes.find((fake) => fake.path === path);
	return {
		notes: () => fakes.map(noteOf),
		frontmatter: (path) => byPath(path)?.frontmatter,
		tags: (path) => byPath(path)?.tags ?? [],
		linksFrom: (path) => byPath(path)?.links ?? [],
		linksTo: (path) => fakes.filter((fake) => fake.links?.includes(path)).map((fake) => fake.path),
		embeds: (path) => byPath(path)?.embeds ?? [],
		size: (path) => byPath(path)?.size ?? 0,
		mtime: (path) => byPath(path)?.mtime ?? HOURS_AGO(48),
		moment,
	};
}
