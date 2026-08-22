import raw from "./changelog.json";

export interface Change {
	version: string;
	date: string | null;
	section?: string;
	text: string;
	tags?: Partial<Record<TagKind, string[]>>;
}

export type TagKind =
	| "unit"
	| "faction"
	| "wielder"
	| "spell"
	| "skill"
	| "building"
	| "artifact";

export interface Version {
	version: string;
	date: string | null;
	hotfix?: boolean;
	raw?: string;
}

const data = raw as unknown as {
	source: string;
	versions: Version[];
	changes: Change[];
};

export const changelogSource = data.source;
export const versions = data.versions;
/** Newest first, the order the archive itself reads in. */
export const changes = data.changes;

const order = new Map(versions.map((v, i) => [v.version, i]));
const byKind = new Map<string, Change[]>();
for (const c of changes) {
	for (const [kind, names] of Object.entries(c.tags ?? {})) {
		for (const name of names) {
			const key = `${kind}|${name}`;
			(byKind.get(key) ?? byKind.set(key, []).get(key))?.push(c);
		}
	}
}

/** Every change that named one of these entities, newest patch first. */
export function changesFor(kind: TagKind, names: string[]): Change[] {
	const seen = new Set<Change>();
	for (const n of names) for (const c of byKind.get(`${kind}|${n}`) ?? []) seen.add(c);
	return [...seen].sort(
		(a, b) => (order.get(a.version) ?? 0) - (order.get(b.version) ?? 0),
	);
}

/** A faction's own line plus everything about its units and buildings. */
export function factionChanges(
	faction: string,
	unitNames: string[],
	buildingNames: string[] = [],
): Change[] {
	const seen = new Set<Change>([
		...changesFor("faction", [faction]),
		...changesFor("unit", unitNames),
		...changesFor("building", buildingNames),
	]);
	return [...seen].sort(
		(a, b) => (order.get(a.version) ?? 0) - (order.get(b.version) ?? 0),
	);
}

const MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");

/** "2026-03-05" -> "Mar 2026"; undated patches just show their version. */
export function patchLabel(c: { version: string; date: string | null }) {
	if (!c.date) return `v${c.version}`;
	const [y, m] = c.date.split("-");
	return `v${c.version} · ${MONTHS[Number(m) - 1]} ${y}`;
}
