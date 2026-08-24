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

/** True when this unit is overpriced for what it does on that tab and variant. */
export const belowMedian = (entry: PowerEntry, variant: Variant, build: Build) => {
	const r = entry[variant][build];
	return !!r && r.eff < EFF_MEDIAN[variant][build][entry.role];
};

export const berserkNote = (entry: PowerEntry, variant: Variant, build: Build) => {
	const b = entry[variant].berserk?.[build];
	return b ? `While berserking: ${b.power} Power / ${b.eff} Efficiency` : undefined;
};
