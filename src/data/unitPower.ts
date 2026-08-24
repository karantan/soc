import unitPowerRaw from "./unitPower.json";

/**
 * Community "Unit Comparison v4" scores, rebuilt by scripts/scrape-unit-power.py.
 *
 * Power is a single combat-strength score for a full stack — offensive output
 * (avg damage x troop size x offence, plus ability modifiers) blended with
 * survivability (health x defence). Efficiency is Power per 1,000 gold of stack
 * cost. Both are synthetic: only their ranking against each other means
 * anything, and both already describe a full stack, so they never rescale.
 *
 * Might scores the bodies alone; Magic adds the value of the essence a unit
 * feeds your wielder's spells, so essence-heavy elites climb on that tab.
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

export interface Rating {
	power: number;
	eff: number;
}

export interface PowerEntry {
	role: "melee" | "ranged";
	might?: Rating;
	magic?: Rating;
	/** The same unit re-scored with its Berserker passive firing. */
	berserk?: { might?: Rating; magic?: Rating };
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
 * its own role.
 */
export const EFF_MEDIAN: Record<Build, Record<"melee" | "ranged", number>> = {
	might: { melee: 0, ranged: 0 },
	magic: { melee: 0, ranged: 0 },
};
for (const build of BUILDS) {
	for (const role of ["melee", "ranged"] as const) {
		EFF_MEDIAN[build][role] = Math.round(
			median(
				Object.values(unitPower)
					.filter((e) => e.role === role && e[build])
					.map((e) => (e[build] as Rating).eff),
			),
		);
	}
}

/** True when this unit is overpriced for what it does on that scoring tab. */
export const belowMedian = (entry: PowerEntry, build: Build) => {
	const r = entry[build];
	return !!r && r.eff < EFF_MEDIAN[build][entry.role];
};

export const berserkNote = (entry: PowerEntry, build: Build) => {
	const b = entry.berserk?.[build];
	return b ? `While berserking: ${b.power} Power / ${b.eff} Efficiency` : undefined;
};
