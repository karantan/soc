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
 *         recruit costs from units.json, and a rebuilt Magic tab where a single
 *         school-weighted essence value is added flat to both Power and
 *         Efficiency instead of scaling each by a different multiplier.
 *         Documented on /power-model/.
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

/** The five essence schools, in the order the game lists them. */
export const SCHOOLS = ["order", "chaos", "creation", "destruction", "arcana"] as const;
export type School = (typeof SCHOOLS)[number];

export const SCHOOL_LABEL: Record<School, string> = {
	order: "Order",
	chaos: "Chaos",
	creation: "Creation",
	destruction: "Destruction",
	arcana: "Arcana",
};

/**
 * The factors an adjusted Power score multiplies out of, each stated as it
 * enters the score, so their product x 1/10 is the raw number and the ratio of
 * any one between two units is that stat's exact share of the gap.
 */
export interface Factors {
	/** troop^0.9 */
	stack: number;
	/** sqrt(average damage x attacks x reach) */
	damage: number;
	/** sqrt(mobility), melee only */
	mobility: number;
	/** sqrt(damage multiplier against the median defence) */
	offence: number;
	/** sqrt(health) */
	health: number;
	/** sqrt(1 / damage taken from the median offence) */
	defence: number;
	/** initiative, relative to the roster median */
	initiative: number;
}

export interface VariantScores {
	might?: Rating;
	magic?: Rating;
	/** The same unit re-scored with its Berserker passive firing. */
	berserk?: { might?: Rating; magic?: Rating };
}

export interface PowerEntry {
	role: "melee" | "ranged";
	/** School-weighted essence value, split by school; Charge Essence included. */
	essence?: Partial<Record<School, number>>;
	factors?: Factors;
	/** Recruit cost of a full stack, in gold-equivalent. */
	goldStack?: number;
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
 * ranged sit on different scales), per tab and variant, split at the median.
 * Above it the ramp runs yellow -> lime -> green, below it muted -> orange ->
 * red, so the whole roster reads as one continuous scale. Thresholds are the
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
	3: "font-bold text-emerald-400",
	2: "font-semibold text-lime-400",
	1: "text-yellow-300",
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

// ---------------------------------------------------------------------------
// Build-relative Magic
// ---------------------------------------------------------------------------

/**
 * A wielder only casts the schools it has skills in, so essence outside them
 * buys nothing. Picking a subset of schools re-scores the Magic tab as that
 * build actually experiences it: the body is unchanged, and only the essence
 * you can spend is credited. All five schools selected reproduces the stored
 * numbers exactly, which is why it's the default.
 */
export const ALL_SCHOOLS: readonly School[] = SCHOOLS;

/** One point of essence value is worth this much of the roster-median body. */
const ESS_POINT = 0.01;

const adjEntries = Object.values(unitPower).filter((e) => e.adj.might);

/** The conversion rate: the same medians scripts/scrape-unit-power.py uses. */
const ADJ_MED = {
	power: median(adjEntries.map((e) => (e.adj.might as Rating).power)),
	eff: median(adjEntries.map((e) => (e.adj.might as Rating).eff)),
};

export const essenceValue = (entry: PowerEntry, schools: readonly School[]) =>
	schools.reduce((sum, s) => sum + (entry.essence?.[s] ?? 0), 0);

/** What the essence adds, on each scale, before rounding into the score. */
export const essenceBonus = (entry: PowerEntry, schools: readonly School[]) => {
	const v = ESS_POINT * essenceValue(entry, schools);
	return { power: v * ADJ_MED.power, eff: v * ADJ_MED.eff };
};

/** Adjusted Magic for a chosen build. Undefined if the unit has no Might row. */
export const magicFor = (
	entry: PowerEntry,
	schools: readonly School[],
): Rating | undefined => {
	const might = entry.adj.might;
	if (!might) return undefined;
	const bonus = essenceBonus(entry, schools);
	return {
		power: Math.round(might.power + bonus.power),
		eff: Math.round(might.eff + bonus.eff),
	};
};

/** True when the selection is every school, i.e. the stored numbers. */
export const isFullBuild = (schools: readonly School[]) =>
	schools.length === SCHOOLS.length;

/**
 * Colour bands for a build-relative score. The percentiles have to be redrawn
 * for each selection — narrowing to one school moves most of the roster to a
 * zero essence bonus, so the distribution is a different shape every time.
 */
const buildBandCache = new Map<string, Record<"melee" | "ranged", Record<Field, number[]>>>();

const buildThresholds = (schools: readonly School[]) => {
	const key = [...schools].sort().join(",");
	const hit = buildBandCache.get(key);
	if (hit) return hit;
	const built = Object.fromEntries(
		(["melee", "ranged"] as const).map((role) => [
			role,
			Object.fromEntries(
				(["power", "eff"] as const).map((field) => {
					const vals = Object.values(unitPower)
						.filter((e) => e.role === role && e.adj.might)
						.map((e) => (magicFor(e, schools) as Rating)[field])
						.sort((a, b) => a - b);
					return [field, [0.1, 0.3, 0.5, 0.7, 0.9].map((q) => percentile(vals, q))];
				}),
			),
		]),
	) as Record<"melee" | "ranged", Record<Field, number[]>>;
	buildBandCache.set(key, built);
	return built;
};

export const magicBandOf = (
	entry: PowerEntry,
	schools: readonly School[],
	field: Field,
): Band | null => {
	const r = magicFor(entry, schools);
	if (!r) return null;
	const [p10, p30, p50, p70, p90] = buildThresholds(schools)[entry.role][field];
	const v = r[field];
	if (v >= p90) return 3;
	if (v >= p70) return 2;
	if (v >= p50) return 1;
	if (v >= p30) return -1;
	if (v >= p10) return -2;
	return -3;
};

/**
 * The factor ladder, in the order it reads best: what the stack is, then what
 * each troop does with it. `eff` marks the one factor that only Efficiency
 * sees, since Efficiency is Power per gold and Power is per stack.
 */
export const FACTOR_ROWS: {
	key: keyof Factors | "cost";
	label: string;
	blurb: string;
	effOnly?: true;
}[] = [
	{ key: "stack", label: "Stack size", blurb: "Troop size, hedged as troop^0.9" },
	{ key: "damage", label: "Damage", blurb: "Average damage, times attacks and reach for ranged" },
	{ key: "offence", label: "Offence", blurb: "Damage multiplier against the roster-median defence" },
	{ key: "health", label: "Health", blurb: "Health per troop" },
	{ key: "defence", label: "Defence", blurb: "Damage taken from the roster-median offence" },
	{ key: "mobility", label: "Movement", blurb: "Melee reach: 25 + 15 x movement" },
	{ key: "initiative", label: "Initiative", blurb: "0.5% per point off the roster median" },
	{ key: "cost", label: "Stack cost", blurb: "Gold for a full stack", effOnly: true },
];

/** A factor's value for one unit, on the scale the ladder multiplies in. */
export const factorValue = (entry: PowerEntry, key: keyof Factors | "cost") =>
	key === "cost"
		? entry.goldStack
			? 10_000 / entry.goldStack
			: undefined
		: entry.factors?.[key];
