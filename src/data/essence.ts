import skillsRaw from "./skillDescriptions.json";
import spellsRaw from "./spells.json";
import unitsRaw from "./units.json";
import { type School, SCHOOLS } from "./unitPower";
import wieldersRaw from "./wielders.json";

/**
 * Essence at the army level, which is the only level it exists at.
 *
 * Every score on this site rates one stack alone, and essence does not work
 * that way: a stack generates its essence once per round no matter how many
 * troops are in it, the whole army's output lands in one shared pool, and
 * spells draw from that pool at fixed costs. So the number that decides
 * whether you can cast Chain Lightning is not any unit's rating, it is what
 * six slots and a wielder produce together against the spell's 12 Chaos.
 *
 * That also makes the value of essence a step function rather than a line.
 * Going from 10 Chaos a round to 12 turns Chain Lightning from a spell you
 * cast every other round into one you cast every round; going from 12 to 14
 * does nothing at all until the next threshold. No per-unit score can express
 * that, which is why this model exists alongside them rather than inside them.
 */

export interface Spell {
	name: string;
	type: "pure" | "dyad";
	schools: School[];
	essences: Partial<Record<School, number>>;
	totalCost: number;
	duration: string;
	tiers: string[];
	image: string;
}

export const spells = spellsRaw as Spell[];

/** A troop slot's worth of essence, per round, by school. */
export interface Battery {
	key: string;
	faction: string;
	name: string;
	image?: string;
	gold: number;
	rare: number;
	essences: Record<School, number>;
	total: number;
	/** Can spend its turn to generate its essence a second time. */
	charge: boolean;
}

type RawTier = {
	name: string;
	essences?: string[];
	cost: Record<string, number>;
	special?: string;
	ability?: string;
	image?: string;
};

const zero = (): Record<School, number> =>
	Object.fromEntries(SCHOOLS.map((s) => [s, 0])) as Record<School, number>;

export const batteries: Battery[] = (
	unitsRaw as { faction: string; base: RawTier; upgraded?: RawTier; upgrades?: RawTier[] }[]
).flatMap((u) => {
	const tiers = [u.base, ...(u.upgraded ? [u.upgraded] : []), ...(u.upgrades ?? [])];
	return tiers.map((t) => {
		const essences = zero();
		for (const e of t.essences ?? []) essences[e as School] += 1;
		return {
			key: `${u.faction}|${t.name}`,
			faction: u.faction,
			name: t.name,
			image: t.image,
			gold: t.cost.gold ?? 0,
			rare: Object.entries(t.cost).reduce((n, [k, v]) => n + (k === "gold" ? 0 : v), 0),
			essences,
			total: Object.values(essences).reduce((a, b) => a + b, 0),
			charge: `${t.special ?? ""} ${t.ability ?? ""}`.includes("Charge Essence"),
		};
	});
});

export const batteryOf = new Map(batteries.map((b) => [b.key, b]));

/**
 * A school's magic skill grants the same essence at every level; what the
 * levels buy is the spell tier. Read from the skill table rather than fixed
 * here, so a balance patch to the wiki data carries through.
 */
const skillLevels = (skillsRaw as { skills: Record<string, string[]> }).skills;

export const MAGIC_SKILL_ESSENCE = (() => {
	const first = skillLevels["Chaos Magic"]?.[0] ?? "";
	return Number(/([+-]?\d+)\s+\w+\s+Essence/i.exec(first)?.[1] ?? 2);
})();

/** Wielders whose specialization is flat essence income, by school. */
export const ESSENCE_WIELDERS = (
	wieldersRaw as { name: string; faction: string; specialization: string }[]
)
	.map((w) => {
		// "+1 Creation Essence to Spikers, Piercers" is conditional, not income
		const m = /^([+-]?\d+)\s+(\w+)\s+essence$/i.exec((w.specialization ?? "").trim());
		if (!m) return null;
		const school = m[2].toLowerCase() as School;
		return SCHOOLS.includes(school)
			? { name: w.name, faction: w.faction, school, amount: Number(m[1]) }
			: null;
	})
	.filter((w): w is { name: string; faction: string; school: School; amount: number } => w !== null);

/** Magic skill level per school: 0 is not taken, and locks that school's spells. */
export type SkillLevels = Record<School, 0 | 1 | 2 | 3>;

export const noSkills = (): SkillLevels => zero() as SkillLevels;

export interface Army {
	/** One entry per filled troop slot; the same unit may hold several. */
	slots: (string | null)[];
	/** Slots whose Charge Essence is being spent, by slot index. */
	charging: boolean[];
	skills: SkillLevels;
	/** Wielder specialization, if it grants flat essence. */
	spec: { school: School; amount: number } | null;
}

/** Essence generated per round, by school. */
export const income = (army: Army): Record<School, number> => {
	const out = zero();
	army.slots.forEach((key, i) => {
		const b = key ? batteryOf.get(key) : undefined;
		if (!b) return;
		const times = army.charging[i] && b.charge ? 2 : 1;
		for (const s of SCHOOLS) out[s] += b.essences[s] * times;
	});
	for (const s of SCHOOLS) {
		if (army.skills[s] > 0) out[s] += MAGIC_SKILL_ESSENCE;
	}
	if (army.spec) out[army.spec.school] += army.spec.amount;
	return out;
};

export interface Cast {
	/** Highest tier this army can cast, 0 when the skill is missing. */
	tier: 0 | 1 | 2 | 3;
	/** Rounds of income per cast. Infinity when a required school is dry. */
	rounds: number;
	/** Turn the first cast lands on, from an empty pool. */
	firstCast: number;
	/** The school that sets the pace, i.e. the one to add more of. */
	binding: School | null;
	/** How much more of `binding` per round would sustain a cast every round. */
	shortBy: number;
}

/**
 * What this army can do with one spell.
 *
 * A dyad needs both of its schools, so its tier is the lower of the two
 * skills. The pace is set by whichever school takes longest to cover, which is
 * also the only school worth adding more of.
 */
export const castOf = (spell: Spell, army: Army, inc: Record<School, number>): Cast => {
	const tier = Math.min(...spell.schools.map((s) => army.skills[s])) as 0 | 1 | 2 | 3;
	let rounds = 0;
	let binding: School | null = null;
	for (const s of spell.schools) {
		const need = spell.essences[s] ?? 0;
		const per = inc[s];
		const r = per > 0 ? need / per : Number.POSITIVE_INFINITY;
		if (r > rounds) {
			rounds = r;
			binding = s;
		}
	}
	const shortBy = binding ? Math.max(0, (spell.essences[binding] ?? 0) - inc[binding]) : 0;
	return {
		tier,
		rounds,
		firstCast: Number.isFinite(rounds) ? Math.max(1, Math.ceil(rounds)) : Number.POSITIVE_INFINITY,
		binding,
		shortBy,
	};
};

/** Batteries ranked by what they add to one school, cheapest first on ties. */
export const bestFor = (school: School, factions?: readonly string[]) =>
	batteries
		.filter((b) => b.essences[school] > 0 && (!factions?.length || factions.includes(b.faction)))
		.sort(
			(a, b) =>
				b.essences[school] - a.essences[school] ||
				a.gold + a.rare * 700 - (b.gold + b.rare * 700),
		);
