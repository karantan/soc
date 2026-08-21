import buildingsRaw from "./buildings.json";
import unitsRaw from "./units.json";

export interface Cost {
	gold?: number;
	wood?: number;
	stone?: number;
	glimmer?: number;
	amber?: number;
	celestial?: number;
}

export interface Produced {
	count: number;
	unit: string;
	garrison?: boolean;
}

interface Ref {
	name: string;
	note?: string;
}

export interface BuildingTier {
	tier: number;
	cost: Cost;
	requires?: Ref[];
	unlocks?: Ref[];
	produces?: Produced[];
	producesImproved?: Produced[];
}

export interface Building {
	faction: string | null;
	size: string | null;
	tiers: BuildingTier[];
	improvement?: { name: string; cost: Cost; description: string | null };
	globalUnlock?: Ref[];
}

export const buildings = buildingsRaw as unknown as Record<string, Building>;

export const RESOURCES = [
	"gold",
	"wood",
	"stone",
	"glimmer",
	"amber",
	"celestial",
] as const;
export type Resource = (typeof RESOURCES)[number];

const tierOfNote = (note?: string) => {
	const m = /Tier\s*(\d)/i.exec(note ?? "");
	return m ? Number(m[1]) : null;
};

/**
 * Requirements are recorded from both ends on the wiki: `prereq` on the building
 * that needs it, and `reqforthistown` ("In-Town Unlock") on the building that
 * satisfies it. The forward `prereq` is authoritative; reverse edges only add
 * requirements the target does not already list, at the lowest tier that claims
 * the unlock (several buildings repeat the same value on every tier row).
 *
 * Reverse edges also have to match faction — the wiki has strays like the Vanir
 * Loggers Camp claiming to unlock Arleon's Barracks.
 */
const reverse = new Map<string, Map<string, number>>();
for (const [name, b] of Object.entries(buildings)) {
	for (const t of b.tiers) {
		for (const u of t.unlocks ?? []) {
			const target = buildings[u.name];
			if (!target) continue;
			if (target.faction && b.faction && target.faction !== b.faction) continue;
			const key = `${u.name}|${tierOfNote(u.note) ?? t.tier}`;
			const at = reverse.get(key) ?? reverse.set(key, new Map()).get(key);
			const prev = at?.get(name);
			if (prev === undefined || t.tier < prev) at?.set(name, t.tier);
		}
	}
}

/** Every (building, tier) that must already stand before this one can be built. */
export function requirementsFor(name: string, tier: number): [string, number][] {
	const out = new Map<string, number>();
	const b = buildings[name];
	if (!b) return [];
	for (const t of b.tiers) {
		if (t.tier > tier) continue;
		for (const r of t.requires ?? []) {
			const rt = tierOfNote(r.note) ?? 1;
			out.set(r.name, Math.max(out.get(r.name) ?? 0, rt));
		}
	}
	for (const t of b.tiers) {
		if (t.tier > tier) continue;
		for (const [rn, rt] of reverse.get(`${name}|${t.tier}`) ?? []) {
			if (!out.has(rn)) out.set(rn, rt);
		}
	}
	return [...out.entries()];
}

const addCost = (into: Cost, from: Cost) => {
	for (const r of RESOURCES) {
		if (from[r]) into[r] = (into[r] ?? 0) + (from[r] ?? 0);
	}
};

export interface UnlockStep {
	building: string;
	tier: number;
	improvement?: string;
	cost: Cost;
	depth: number;
}

/** Full build-out needed for a building at a tier: itself, its tiers, and every prerequisite. */
export function unlockChain(name: string, tier: number, improved = false): UnlockStep[] {
	// A building can be pulled in twice at different tiers (a prereq listed at T1
	// and again as an unlock at T2). Keep the highest tier per building so its
	// lower tiers are only paid for once.
	const need = new Map<string, { tier: number; depth: number }>();
	const walk = (b: string, t: number, depth: number) => {
		if (!buildings[b]) return;
		const seen = need.get(b);
		if (seen && seen.tier >= t) {
			if (depth < seen.depth) seen.depth = depth;
			return;
		}
		need.set(b, { tier: t, depth: seen ? Math.min(seen.depth, depth) : depth });
		for (const [rn, rt] of requirementsFor(b, t)) walk(rn, rt, depth + 1);
	};
	walk(name, tier, 0);

	return [...need.entries()]
		.map(([b, { tier: t, depth }]) => {
			const cost: Cost = {};
			for (const bt of buildings[b].tiers) if (bt.tier <= t) addCost(cost, bt.cost);
			const step: UnlockStep = { building: b, tier: t, cost, depth };
			const imp = buildings[b].improvement;
			if (b === name && improved && imp) {
				step.improvement = imp.name;
				addCost(cost, imp.cost);
			}
			return step;
		})
		.sort((a, b) => a.depth - b.depth || a.building.localeCompare(b.building));
}

export const totalCost = (steps: UnlockStep[]) => {
	const out: Cost = {};
	for (const s of steps) addCost(out, s.cost);
	return out;
};

const norm = (s: string) => {
	let x = s.toLowerCase().replace(/[^a-z0-9]/g, "");
	if (x.endsWith("men")) x = `${x.slice(0, -3)}man`;
	return x.endsWith("s") && !x.endsWith("ss") ? x.slice(0, -1) : x;
};

export interface Producer {
	building: string;
	tier: number;
	improved: boolean;
	per: number;
}

/**
 * Where a unit is produced: building, tier, and whether it needs the improvement.
 * Garrison-only entries (the Ballista in a Guard Tower) are a fallback, so a real
 * production building always wins if one exists.
 */
export function producerOf(unitName: string): Producer | null {
	const want = norm(unitName);
	let garrison: Producer | null = null;
	for (const [name, b] of Object.entries(buildings)) {
		for (const t of b.tiers) {
			for (const [improved, list] of [
				[false, t.produces],
				[true, t.producesImproved],
			] as const) {
				for (const p of list ?? []) {
					if (norm(p.unit) !== want) continue;
					const hit = { building: name, tier: t.tier, improved, per: p.count };
					if (!p.garrison) return hit;
					garrison ??= hit;
				}
			}
		}
	}
	return garrison;
}

/**
 * Troops per round the building makes. Prefers its first tier's real production;
 * a tower that only ever fills a garrison falls back to what it garrisons last
 * (a Guard Tower's Ballista).
 */
export function growthOf(name: string) {
	const b = buildings[name];
	if (!b) return null;
	const first = (b.tiers[0]?.produces ?? []).find((x) => !x.garrison);
	if (first) return first.count;
	const all = b.tiers.flatMap((t) => t.produces ?? []);
	return all.length ? all[all.length - 1].count : null;
}

export const sizeOf = (name: string) => buildings[name]?.size ?? null;

const units = unitsRaw as unknown as {
	faction: string;
	building: string;
	base: { name: string; image?: string | null };
	upgraded?: { name: string; image?: string | null };
	upgrades?: { name: string; image?: string | null; house?: string }[];
}[];

export interface UnlockRow {
	faction: string;
	unit: string;
	image?: string | null;
	tierLabel: string;
	producer: Producer;
	steps: UnlockStep[];
	cost: Cost;
}

/** One row per unit tier the game lets you produce, with what it costs to get there. */
export function unlockRows(faction?: string): UnlockRow[] {
	const rows: UnlockRow[] = [];
	for (const u of units) {
		if (faction && u.faction !== faction) continue;
		const tiers = [
			{ label: "Base", t: u.base },
			...(u.upgraded ? [{ label: "Upgraded", t: u.upgraded }] : []),
			...(u.upgrades ?? []).map((t) => ({ label: t.house ?? "Upgraded", t })),
		];
		for (const { label, t } of tiers) {
			const producer = producerOf(t.name);
			if (!producer) continue;
			const steps = unlockChain(
				producer.building,
				producer.tier,
				producer.improved,
			);
			rows.push({
				faction: u.faction,
				unit: t.name,
				image: t.image,
				tierLabel: label,
				producer,
				steps,
				cost: totalCost(steps),
			});
		}
	}
	return rows;
}

/**
 * What the whole set of rows costs together, counting each building (and each
 * improvement) once at the highest tier any of them needs — summing the rows
 * individually would charge shared prerequisites over and over.
 */
export function combinedCost(rows: { steps: UnlockStep[] }[]): Cost {
	const tier = new Map<string, number>();
	const improved = new Set<string>();
	for (const r of rows) {
		for (const s of r.steps) {
			tier.set(s.building, Math.max(tier.get(s.building) ?? 0, s.tier));
			if (s.improvement) improved.add(s.building);
		}
	}
	const out: Cost = {};
	for (const [name, t] of tier) {
		const b = buildings[name];
		if (!b) continue;
		for (const bt of b.tiers) if (bt.tier <= t) addCost(out, bt.cost);
		if (improved.has(name) && b.improvement) addCost(out, b.improvement.cost);
	}
	return out;
}
