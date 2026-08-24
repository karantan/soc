import unitPowerRaw from "./unitPower.json";

/**
 * Unit Power / Efficiency scores, rebuilt by scripts/scrape-unit-power.py.
 *
 * Power is a single combat-strength score for a full stack — offensive output
 * blended with survivability. Efficiency is Power per gold. Both are synthetic:
 * only their ranking against each other means anything.
 *
 * Two scoring tabs (Might scores the bodies alone; Magic adds the value of the
 * essence a unit feeds your wielder's spells) times two variants:
 *
 *   v4  — the community "Unit Comparison v4" sheet's numbers, verbatim.
 *   adj — the Codex adjustments: mobility and initiative priced in, offence/
 *         defence scored against the roster-median opponent at the game's
 *         asymmetric rates, troop^0.9 swarm hedge, one Berserker convention,
 *         recruit costs from units.json. Documented on /power-model/.
 *
 * Source: https://steamcommunity.com/app/867210/discussions/0/563659290304345947/
 */

/** Which scoring tab a Power/Efficiency pair comes from. */
export type Build = "might" | "magic";

export const BUILDS: Build[] = ["might", "magic"];

export const BUILD_LABEL: Record<Build, string> = {
	might: "Might",
	magic: "Magic",
};

export const BUILD_BLURB: Record<Build, string> = {
	might: "Bodies alone — damage, health, offence, defence and abilities, no magic",
	magic: "The same bodies plus the value of the essence this unit feeds your spells",
};

/** Which scoring model: the community sheet verbatim, or the Codex adjustments. */
export type Variant = "v4" | "adj";

export const VARIANTS: Variant[] = ["adj", "v4"];

export const VARIANT_LABEL: Record<Variant, string> = {
	adj: "Codex adjusted",
	v4: "Sheet v4",
};

export const VARIANT_BLURB: Record<Variant, string> = {
	adj: "The v4 model with mobility, initiative and matchup-relative offence/defence priced in — every change documented on the Power Model page",
	v4: "The community Unit Comparison v4 sheet's numbers, verbatim",
};

export interface Rating {
	power: number;
	eff: number;
}

export interface VariantScores {
	might?: Rating;
	magic?: Rating;
	/** The same unit re-scored with its Berserker passive firing. */
	berserk?: { might?: Rating; magic?: Rating };
}

export interface PowerEntry {
	role: "melee" | "ranged";
	v4: VariantScores;
	adj: VariantScores;
}

export const unitPower = unitPowerRaw as Record<string, PowerEntry>;

export const powerOf = (faction: string, name: string): PowerEntry | undefined =>
	unitPower[`${faction}|${name}`];

const median = (xs: number[]) => {
	const s = [...xs].sort((a, b) => a - b);
	const m = s.length >> 1;
	return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * Melee and ranged sit on different scales — ranged pays a "safety tax" for
 * dealing damage without being hit back — so a unit is only ever judged against
 * its own role, within its own variant.
 */
export const EFF_MEDIAN: Record<
	Variant,
	Record<Build, Record<"melee" | "ranged", number>>
> = {
	v4: { might: { melee: 0, ranged: 0 }, magic: { melee: 0, ranged: 0 } },
	adj: { might: { melee: 0, ranged: 0 }, magic: { melee: 0, ranged: 0 } },
};
for (const variant of VARIANTS) {
	for (const build of BUILDS) {
		for (const role of ["melee", "ranged"] as const) {
			EFF_MEDIAN[variant][build][role] = Math.round(
				median(
					Object.values(unitPower)
						.filter((e) => e.role === role && e[variant][build])
						.map((e) => (e[variant][build] as Rating).eff),
				),
			);
		}
	}
}

/**
 * Colour bands: each score is ranked by percentile within its role (melee and
 * ranged sit on different scales), per tab and variant, split at the median —
 * three green shades above it, muted/orange/red below. Thresholds are the
 * p10/p30/p50/p70/p90 values of each distribution.
 */
export type Band = -3 | -2 | -1 | 1 | 2 | 3;

type Field = "power" | "eff";

const percentile = (sorted: number[], q: number) =>
	sorted[Math.max(0, Math.ceil(q * sorted.length) - 1)];

const thresholdsFor = (variant: Variant, build: Build, role: "melee" | "ranged") =>
	Object.fromEntries(
		(["power", "eff"] as const).map((field) => {
			const vals = Object.values(unitPower)
				.filter((e) => e.role === role && e[variant][build])
				.map((e) => (e[variant][build] as Rating)[field])
				.sort((a, b) => a - b);
			return [field, [0.1, 0.3, 0.5, 0.7, 0.9].map((q) => percentile(vals, q))];
		}),
	) as Record<Field, number[]>;

const THRESHOLDS = Object.fromEntries(
	VARIANTS.map((variant) => [
		variant,
		Object.fromEntries(
			BUILDS.map((build) => [
				build,
				Object.fromEntries(
					(["melee", "ranged"] as const).map((role) => [
						role,
						thresholdsFor(variant, build, role),
					]),
				),
			]),
		),
	]),
) as Record<Variant, Record<Build, Record<"melee" | "ranged", Record<Field, number[]>>>>;

export const bandOf = (
	entry: PowerEntry,
	variant: Variant,
	build: Build,
	field: Field,
): Band | null => {
	const r = entry[variant][build];
	if (!r) return null;
	const [p10, p30, p50, p70, p90] = THRESHOLDS[variant][build][entry.role][field];
	const v = r[field];
	if (v >= p90) return 3;
	if (v >= p70) return 2;
	if (v >= p50) return 1;
	if (v >= p30) return -1;
	if (v >= p10) return -2;
	return -3;
};

export const BAND_CLASS: Record<Band, string> = {
	3: "font-bold text-emerald-300",
	2: "font-semibold text-emerald-400",
	1: "text-emerald-500",
	"-1": "text-muted-foreground",
	"-2": "text-orange-400/90",
	"-3": "text-red-400",
};

export const BAND_LABEL: Record<Band, string> = {
	3: "top 10%",
	2: "top 10–30%",
	1: "above the median",
	"-1": "below the median",
	"-2": "bottom 10–30%",
	"-3": "bottom 10%",
};

export const berserkNote = (entry: PowerEntry, variant: Variant, build: Build) => {
	const b = entry[variant].berserk?.[build];
	return b ? `While berserking: ${b.power} Power / ${b.eff} Efficiency` : undefined;
};
