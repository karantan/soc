import { useMemo, useState } from "react";
import { factions } from "../data/factions";
import { factionStyles } from "../data/factionStyles";
import unitsRaw from "../data/units.json";
import unitPotentialRaw from "../data/unitPotential.json";
import unitPowerRaw from "../data/unitPower.json";
import unitResearchRaw from "../data/unitResearch.json";
import { ResearchLevels } from "./ResearchPanel";
import { AbilityTokens, Tip } from "./Tip";

const unitResearch = unitResearchRaw as Record<
	string,
	{
		building: string;
		name: string;
		levels: { cost: Record<string, number>; effect: string }[];
	}[]
>;

function ResearchBadge({ uid }: { uid: string }) {
	const entries = unitResearch[uid];
	if (!entries) return null;
	return (
		<Tip
			label={
				<span
					className="cursor-help rounded border border-border bg-secondary px-1 py-px text-[10px] text-muted-foreground transition-colors hover:border-gold/60 hover:text-gold"
					title=""
				>
					⚗ {entries.length}
				</span>
			}
		>
			<span className="font-display font-bold text-gold">Research</span>
			{entries.map((e) => (
				<span key={e.name} className="mt-1.5 block">
					<span className="font-semibold text-foreground/90">{e.name}</span>
					<span className="text-muted-foreground"> — {e.building}</span>
					<ResearchLevels levels={e.levels} />
				</span>
			))}
		</Tip>
	);
}

const shortName = (faction: string) =>
	factions.find((f) => f.name === faction)?.shortName ?? faction;

type Tier = "base" | "upgraded";

interface TierData {
	name: string;
	essences: string[];
	cost: Record<string, number>;
	damage: string;
	health: string;
	offence: string;
	defence: string;
	movement: string;
	initiative: string;
	range: string;
	special: string;
	ability: string;
	image?: string;
}

interface Unit {
	faction: string;
	building: string;
	maxTroopSize: string;
	base: TierData;
	upgraded?: TierData;
	/** Yulan lines upgrade into one of three house variants. */
	upgrades?: (TierData & { house: string; maxTroopSize?: string })[];
	note?: string;
}

interface Row {
	/** true when max-potential data is unavailable for this unit */
	unrated?: boolean;
	id: string;
	faction: string;
	tier: Tier;
	maxTroopSize: string;
	building: string;
	baseName: string;
	d: TierData;
}

const units = unitsRaw as Unit[];

const rows: Row[] = units.flatMap((u) => {
	const out: Row[] = [
		{
			id: `${u.faction}-${u.base.name}`,
			faction: u.faction,
			tier: "base",
			maxTroopSize: u.maxTroopSize,
			building: u.building,
			baseName: u.base.name,
			d: u.base,
		},
	];
	if (u.upgraded) {
		out.push({
			id: `${u.faction}-${u.upgraded.name}`,
			faction: u.faction,
			tier: "upgraded",
			maxTroopSize: u.maxTroopSize,
			building: u.building,
			baseName: u.base.name,
			d: u.upgraded,
		});
	}
	for (const up of u.upgrades ?? []) {
		out.push({
			id: `${u.faction}-${up.name}`,
			faction: u.faction,
			tier: "upgraded",
			maxTroopSize: up.maxTroopSize ?? u.maxTroopSize,
			building: u.building,
			baseName: u.base.name,
			d: up,
		});
	}
	return out;
});

const firstNum = (s: string) => {
	const m = s.match(/\d+/);
	return m ? Number(m[0]) : 0;
};

/** Stats that scale with how many entities a full stack holds. */
type Scale = "unit" | "stack" | "max";

interface Potential {
	maxTroopSize: number;
	health: number;
	damage: string;
	offence: string;
	defence: number;
	movement: number;
	initiative: number;
}

/** Fully-researched stats (every troop improvement bought) per unit. */
const unitPotential = unitPotentialRaw as Record<string, Potential>;

const potentialOf = (r: Row) => unitPotential[`${r.faction}|${r.d.name}`];

/** Which scoring tab the Power/Efficiency columns read from. */
type Build = "might" | "magic";

interface Rating {
	power: number;
	eff: number;
}

interface PowerEntry {
	role: "melee" | "ranged";
	might?: Rating;
	magic?: Rating;
	/** Values while the unit's Berserker passive is firing. */
	berserk?: { might?: Rating; magic?: Rating };
}

/**
 * Community "Unit Comparison v4" scores. Power is a single combat-strength
 * score for a full stack — offensive output (avg damage x troop size x offence,
 * plus ability modifiers) blended with survivability (health x defence).
 * Efficiency is Power per 1,000 gold of stack cost. Both are synthetic: only
 * their ranking against each other means anything.
 *
 * Might scores the bodies alone; Magic adds the value of the essence a unit
 * feeds your wielder's spells, so essence-heavy elites climb on that tab.
 *
 * Source: https://steamcommunity.com/app/867210/discussions/0/563659290304345947/
 */
const unitPower = unitPowerRaw as Record<string, PowerEntry>;

const powerEntry = (r: Row): PowerEntry | undefined =>
	unitPower[`${r.faction}|${r.d.name}`];

const ratingOf = (r: Row, build: Build) => powerEntry(r)?.[build];

const median = (xs: number[]) => {
	const s = [...xs].sort((a, b) => a - b);
	const m = s.length >> 1;
	return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * Melee and ranged are scored on different scales — ranged pays a "safety tax"
 * for hitting without being hit — so a unit is judged against its own role.
 */
const EFF_MEDIAN: Record<Build, Record<"melee" | "ranged", number>> = {
	might: { melee: 0, ranged: 0 },
	magic: { melee: 0, ranged: 0 },
};
for (const build of ["might", "magic"] as const) {
	for (const role of ["melee", "ranged"] as const) {
		const vals = Object.values(unitPower)
			.filter((e) => e.role === role && e[build])
			.map((e) => (e[build] as Rating).eff);
		EFF_MEDIAN[build][role] = Math.round(median(vals));
	}
}

const stackCount = (r: Row) => firstNum(r.maxTroopSize) || 1;

// multiply every number in a stat string: "2-3" x100 -> "200-300"
const scaleNums = (s: string, n: number) =>
	s.replace(/\d+/g, (m) => String(Number(m) * n));

/**
 * A full stack's totals: cost, health and damage are per-entity in the game's
 * stat sheet, so a 100-strong Rat stack fields 100x each. Offence, defence,
 * movement, initiative and range are per-stack qualities and never scale.
 */
const scaleRow = (r: Row, scale: Scale): Row => {
	if (scale === "unit") return r;
	if (scale === "max") {
		// every research bought, stack at its researched maximum
		const p = potentialOf(r);
		if (!p) return { ...r, unrated: true };
		const n = p.maxTroopSize;
		return {
			...r,
			maxTroopSize: String(n),
			d: {
				...r.d,
				cost: Object.fromEntries(
					Object.entries(r.d.cost).map(([k, v]) => [k, v * n]),
				),
				damage: scaleNums(p.damage, n),
				health: scaleNums(String(p.health), n),
				offence: p.offence,
				defence: String(p.defence),
				movement: String(p.movement),
				initiative: String(p.initiative),
			},
		};
	}
	const n = stackCount(r);
	return {
		...r,
		d: {
			...r.d,
			cost: Object.fromEntries(
				Object.entries(r.d.cost).map(([k, v]) => [k, v * n]),
			),
			damage: scaleNums(r.d.damage, n),
			health: scaleNums(r.d.health, n),
		},
	};
};

// "2-3" -> 2.5, "40-60" -> 50, "7" -> 7
const avgDamage = (s: string) => {
	const nums = s.match(/\d+/g);
	if (!nums) return 0;
	return nums.map(Number).reduce((a, b) => a + b, 0) / nums.length;
};

// "5/13" -> 13 (best of melee/ranged), "6" -> 6
const maxNum = (s: string) => {
	const nums = s.match(/\d+/g);
	return nums ? Math.max(...nums.map(Number)) : 0;
};

const goldCost = (c: Record<string, number>) => c.gold ?? 0;

type SortKey =
	| "name"
	| "cost"
	| "damage"
	| "health"
	| "offence"
	| "defence"
	| "movement"
	| "initiative"
	| "range"
	| "maxTroopSize"
	| "costPerHp"
	| "costPerDmg"
	| "power"
	| "eff";

/** Power and Efficiency are already full-stack scores, so they never rescale. */
const RATED_COLUMNS = new Set<SortKey>(["power", "eff"]);

const sortValue = (r: Row, key: SortKey, build: Build): number | string => {
	if (r.unrated && key !== "name" && !RATED_COLUMNS.has(key))
		return Number.POSITIVE_INFINITY;
	switch (key) {
		case "power":
			return ratingOf(r, build)?.power ?? 0;
		case "eff":
			return ratingOf(r, build)?.eff ?? 0;
		case "name":
			return r.d.name;
		case "cost":
			return goldCost(r.d.cost);
		case "damage":
			return avgDamage(r.d.damage);
		case "health":
			return firstNum(r.d.health);
		case "offence":
			return maxNum(r.d.offence);
		case "defence":
			return firstNum(r.d.defence);
		case "movement":
			return firstNum(r.d.movement);
		case "initiative":
			return firstNum(r.d.initiative);
		case "range":
			return maxNum(r.d.range);
		case "maxTroopSize":
			return firstNum(r.maxTroopSize);
		case "costPerHp":
			return ratio(goldCost(r.d.cost), firstNum(r.d.health));
		case "costPerDmg":
			return ratio(goldCost(r.d.cost), avgDamage(r.d.damage));
	}
};

/**
 * Gold per point of HP / damage — how much value a unit buys. Identical in
 * per-unit and full-stack mode (both sides scale by troop size). Infinity for
 * summoned units (no gold cost) so they sort last and never win "best".
 */
const ratio = (gold: number, per: number) =>
	gold > 0 && per > 0 ? gold / per : Number.POSITIVE_INFINITY;

const fmtRatio = (v: number) =>
	Number.isFinite(v) ? (v < 100 ? v.toFixed(1) : Math.round(v).toString()) : "—";

const COLUMNS: { key: SortKey; label: string; title: string }[] = [
	{ key: "cost", label: "Cost", title: "Recruitment cost" },
	{ key: "damage", label: "Dmg", title: "Damage per entity" },
	{ key: "health", label: "HP", title: "Health per entity" },
	{ key: "offence", label: "Off", title: "Melee/Ranged offence" },
	{ key: "defence", label: "Def", title: "Defence" },
	{ key: "movement", label: "Mov", title: "Movement" },
	{ key: "initiative", label: "Init", title: "Initiative" },
	{ key: "range", label: "Range", title: "Max/Deadly range" },
	{ key: "maxTroopSize", label: "Troop", title: "Max troop size" },
	{
		key: "costPerHp",
		label: "g/HP",
		title: "Gold per point of health — lower is better (same in both modes)",
	},
	{
		key: "costPerDmg",
		label: "g/Dmg",
		title:
			"Gold per point of average damage — lower is better (same in both modes)",
	},
	{
		key: "power",
		label: "Pwr",
		title:
			"Max Power — full-stack combat strength (damage x troop size x offence, blended with health x defence). Already a stack total, so it never rescales",
	},
	{
		key: "eff",
		label: "Eff",
		title:
			"Efficiency — Power per 1,000 gold of stack cost. Dimmed when below the median for that unit's role",
	},
];

const SCALED_COLUMNS = new Set<SortKey>(["cost", "damage", "health"]);

/** Columns where a smaller number is the better one. */
const LOWER_IS_BETTER = new Set<SortKey>(["cost", "costPerHp", "costPerDmg"]);

const RESOURCE_ICONS: Record<string, string> = {
	gold: "/images/units/icon-gold.jpg",
	amber: "/images/units/icon-amber.jpg",
	celestial: "/images/units/icon-celestial.jpg",
	glimmer: "/images/units/icon-glimmer.jpg",
};

function Essences({ list }: { list: string[] }) {
	return (
		<span className="inline-flex gap-0.5 align-middle">
			{list.map((e, i) => (
				<img
					key={`${e}-${i}`}
					src={`/images/units/icon-${e}.jpg`}
					alt={e}
					title={`${e} essence`}
					className="h-3.5 w-3.5 rounded-[2px]"
				/>
			))}
		</span>
	);
}

function Cost({ cost }: { cost: Record<string, number> }) {
	const entries = Object.entries(cost);
	if (entries.length === 0)
		return <span className="text-muted-foreground">—</span>;
	return (
		<span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5">
			{entries.map(([res, n]) => (
				<span key={res} className="inline-flex items-center gap-1 whitespace-nowrap">
					{n}
					{RESOURCE_ICONS[res] ? (
						<img
							src={RESOURCE_ICONS[res]}
							alt={res}
							title={res}
							className="h-3.5 w-3.5 rounded-[2px]"
						/>
					) : (
						<span className="text-xs text-muted-foreground">{res}</span>
					)}
				</span>
			))}
		</span>
	);
}

function PowerCell({
	r,
	build,
	field,
}: {
	r: Row;
	build: Build;
	field: "power" | "eff";
}) {
	const entry = powerEntry(r);
	const v = entry?.[build];
	if (!entry || !v) return <span className="text-muted-foreground">—</span>;
	const b = entry.berserk?.[build];
	const cut = EFF_MEDIAN[build][entry.role];
	const below = field === "eff" && v.eff < cut;
	return (
		<span
			className={below ? "text-muted-foreground/70" : undefined}
			title={
				below
					? `Below the ${entry.role} efficiency median (${cut}) — overpriced for what it does`
					: undefined
			}
		>
			{v[field]}
			{b && (
				<sup
					className="ml-0.5 cursor-help text-[9px] text-gold"
					title={`While berserking: ${b.power} Power / ${b.eff} Efficiency`}
				>
					B
				</sup>
			)}
		</span>
	);
}

const DUEL_STATS: {
	key: SortKey | "special" | "ability" | "building";
	label: string;
	numeric: boolean;
	lowerBetter?: boolean;
}[] = [
	{ key: "cost", label: "Cost", numeric: true, lowerBetter: true },
	{ key: "damage", label: "Damage", numeric: true },
	{ key: "health", label: "Health", numeric: true },
	{ key: "offence", label: "Offence", numeric: true },
	{ key: "defence", label: "Defence", numeric: true },
	{ key: "movement", label: "Movement", numeric: true },
	{ key: "initiative", label: "Initiative", numeric: true },
	{ key: "range", label: "Range", numeric: true },
	{ key: "maxTroopSize", label: "Max troop", numeric: true },
	{ key: "costPerHp", label: "Gold / HP", numeric: true, lowerBetter: true },
	{
		key: "costPerDmg",
		label: "Gold / Dmg",
		numeric: true,
		lowerBetter: true,
	},
	{ key: "power", label: "Power", numeric: true },
	{ key: "eff", label: "Efficiency", numeric: true },
	{ key: "special", label: "Special", numeric: false },
	{ key: "ability", label: "Ability", numeric: false },
	{ key: "building", label: "Building", numeric: false },
];

function DuelPanel({
	pair,
	onRemove,
	onClear,
	scaled,
	build,
}: {
	pair: Row[];
	onRemove: (id: string) => void;
	onClear: () => void;
	scaled: boolean;
	build: Build;
}) {
	const [a, b] = pair;
	const text = (r: Row, key: string): string => {
		if (key === "power" || key === "eff") {
			const v = ratingOf(r, build);
			return v ? String(key === "power" ? v.power : v.eff) : "—";
		}
		if (r.unrated) return "—";
		if (key === "special") return r.d.special || "—";
		if (key === "ability") return r.d.ability || "—";
		if (key === "building") return r.building || "—";
		if (key === "maxTroopSize") return r.maxTroopSize;
		if (key === "costPerHp" || key === "costPerDmg")
			return fmtRatio(sortValue(r, key, build) as number);
		return (r.d as unknown as Record<string, string>)[key] || "—";
	};
	const head = (r: Row) => {
		const fs = factionStyles[r.faction];
		return (
			<div className="flex flex-col items-center gap-1.5 text-center">
				{r.d.image && (
					<img
						src={`/images/units/${r.d.image}`}
						alt={r.d.name}
						className="h-16 w-16 rounded border border-border object-cover"
					/>
				)}
				<div className="font-display font-bold leading-tight">
					{r.d.name}
					{r.tier === "upgraded" && (
						<span className="text-gold text-xs ml-1" title="Upgraded unit">
							★
						</span>
					)}
				</div>
				<div className="flex items-center gap-1.5">
					<span
						className={`rounded px-1 py-px text-[10px] font-semibold ${fs.badge}`}
					>
						{shortName(r.faction)}
					</span>
					<Essences list={r.d.essences} />
				</div>
				<button
					type="button"
					className="text-xs text-muted-foreground underline hover:text-foreground"
					onClick={() => onRemove(r.id)}
				>
					remove
				</button>
			</div>
		);
	};
	return (
		<div className="rounded-lg border border-gold/40 bg-card shadow-medium">
			<div className="flex items-center justify-between border-b border-border/60 px-4 py-2.5">
				<h2 className="font-display text-sm font-bold uppercase tracking-wider text-gold">
					Duel — head to head
				</h2>
				<button
					type="button"
					className="text-xs text-muted-foreground underline hover:text-foreground"
					onClick={onClear}
				>
					clear
				</button>
			</div>
			{b ? (
				<div className="p-4">
					<div className="grid grid-cols-[1fr_auto_1fr] items-start gap-x-4">
						{head(a)}
						<span className="self-center font-display text-2xl font-black text-muted-foreground">
							vs
						</span>
						{head(b)}
					</div>
					<dl className="mt-4 divide-y divide-border/50 text-sm">
						{DUEL_STATS.map((st) => {
							let winA = false;
							let winB = false;
							if (st.numeric) {
								const va = sortValue(a, st.key as SortKey, build) as number;
								const vb = sortValue(b, st.key as SortKey, build) as number;
								if (
									va !== vb &&
									va > 0 &&
									vb > 0 &&
									Number.isFinite(va) &&
									Number.isFinite(vb)
								) {
									const aBetter = st.lowerBetter ? va < vb : va > vb;
									winA = aBetter;
									winB = !aBetter;
								}
							}
							const render = (r: Row) => {
								if (st.key === "power" || st.key === "eff")
									return text(r, st.key);
								if (r.unrated) return "—";
								if (st.key === "cost") return <Cost cost={r.d.cost} />;
								if (st.key === "special" || st.key === "ability")
									return <AbilityTokens text={text(r, st.key)} />;
								return text(r, st.key);
							};
							const cellA = render(a);
							const cellB = render(b);
							return (
								<div
									key={st.key}
									className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-4 py-1.5"
								>
									<span
										className={`text-right tabular-nums ${winA ? "font-bold text-gold" : ""} ${st.numeric ? "" : "text-xs text-muted-foreground"}`}
									>
										{cellA}
									</span>
									<dt className="w-24 text-center text-[11px] uppercase tracking-wider text-muted-foreground font-display">
										{st.label}
										{scaled && SCALED_COLUMNS.has(st.key as SortKey) && (
											<span className="ml-0.5 text-gold">Σ</span>
										)}
									</dt>
									<span
										className={`tabular-nums ${winB ? "font-bold text-gold" : ""} ${st.numeric ? "" : "text-xs text-muted-foreground"}`}
									>
										{cellB}
									</span>
								</div>
							);
						})}
					</dl>
				</div>
			) : (
				<div className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-4 p-4">
					{head(a)}
					<span className="font-display text-2xl font-black text-muted-foreground">
						vs
					</span>
					<p className="text-center text-sm text-muted-foreground">
						Pick a second unit in the table below.
					</p>
				</div>
			)}
		</div>
	);
}

export default function CompareTable() {
	const [factionFilter, setFactionFilter] = useState<string>("all");
	const [tierFilter, setTierFilter] = useState<"base" | "upgraded" | "both">(
		"upgraded",
	);
	const [sortKey, setSortKey] = useState<SortKey | null>(null);
	const [sortDir, setSortDir] = useState<1 | -1>(-1);
	const [picked, setPicked] = useState<string[]>([]);
	const [scale, setScale] = useState<Scale>("unit");
	const [build, setBuild] = useState<Build>("might");

	const togglePick = (id: string) => {
		setPicked((p) => {
			if (p.includes(id)) return p.filter((x) => x !== id);
			if (p.length >= 2) return [p[1], id]; // replace the oldest pick
			return [...p, id];
		});
	};

	const visible = useMemo(() => {
		let out = rows
			.filter(
				(r) =>
					(factionFilter === "all" || r.faction === factionFilter) &&
					(tierFilter === "both" || r.tier === tierFilter),
			)
			.map((r) => scaleRow(r, scale));
		if (sortKey) {
			out = [...out].sort((a, b) => {
				// rows without data always sink, whichever way we're sorting
				if (!!a.unrated !== !!b.unrated) return a.unrated ? 1 : -1;
				const va = sortValue(a, sortKey, build);
				const vb = sortValue(b, sortKey, build);
				if (typeof va === "string" || typeof vb === "string")
					return String(va).localeCompare(String(vb)) * sortDir;
				return (va - vb) * sortDir;
			});
		}
		return out;
	}, [factionFilter, tierFilter, sortKey, sortDir, scale, build]);

	// best (max) value per numeric column among visible rows; for cost, best = lowest
	const best = useMemo(() => {
		const b: Partial<Record<SortKey, number>> = {};
		for (const col of COLUMNS) {
			const vals = visible
				.map((r) => sortValue(r, col.key, build) as number)
				.filter((v) => Number.isFinite(v) && v > 0);
			if (vals.length > 1)
				b[col.key] = LOWER_IS_BETTER.has(col.key)
					? Math.min(...vals)
					: Math.max(...vals);
		}
		return b;
	}, [visible, build]);

	const toggleSort = (key: SortKey) => {
		if (sortKey === key) {
			setSortDir((d) => (d === 1 ? -1 : 1));
		} else {
			setSortKey(key);
			setSortDir(LOWER_IS_BETTER.has(key) || key === "name" ? 1 : -1);
		}
	};

	const cellValue = (r: Row, key: SortKey): string => {
		if (r.unrated) return "—";
		if (key === "power" || key === "eff") return "";
		switch (key) {
			case "cost":
				return "";
			case "damage":
				return r.d.damage;
			case "health":
				return r.d.health;
			case "offence":
				return r.d.offence;
			case "defence":
				return r.d.defence;
			case "movement":
				return r.d.movement;
			case "initiative":
				return r.d.initiative;
			case "range":
				return r.d.range || "—";
			case "maxTroopSize":
				return r.maxTroopSize;
			case "costPerHp":
			case "costPerDmg":
				return fmtRatio(sortValue(r, key, build) as number);
			default:
				return "";
		}
	};

	const seg = (active: boolean) =>
		`px-3 py-1.5 text-sm rounded-md transition-colors ${
			active
				? "bg-primary text-primary-foreground font-semibold"
				: "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
		}`;

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-center gap-x-6 gap-y-3">
				<div className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-card p-1">
					{[
						["all", "All"],
						...factions.map((f) => [f.name, f.shortName]),
					].map(([val, label]) => (
						<button
							key={val}
							type="button"
							className={seg(factionFilter === val)}
							onClick={() => setFactionFilter(val)}
						>
							{label}
						</button>
					))}
				</div>
				<div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
					{(
						[
							["base", "Base"],
							["upgraded", "Upgraded"],
							["both", "Both"],
						] as const
					).map(([val, label]) => (
						<button
							key={val}
							type="button"
							className={seg(tierFilter === val)}
							onClick={() => setTierFilter(val)}
						>
							{label}
						</button>
					))}
				</div>
				<div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
					{(
						[
							["unit", "Per unit"],
							["stack", "Full stack"],
							["max", "Max potential"],
						] as const
					).map(([val, label]) => (
						<button
							key={val}
							type="button"
							className={seg(scale === val)}
							onClick={() => setScale(val)}
							title={
								val === "unit"
									? "Stats for a single entity, as shown in-game"
									: val === "stack"
										? "Cost, damage and HP multiplied by max troop size"
										: "Every troop research bought, at the researched max stack size"
							}
						>
							{label}
						</button>
					))}
				</div>
				<div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
					{(
						[
							["might", "Might"],
							["magic", "Magic"],
						] as const
					).map(([val, label]) => (
						<button
							key={val}
							type="button"
							className={seg(build === val)}
							onClick={() => setBuild(val)}
							title={
								val === "might"
									? "Power and Efficiency scored on bodies alone — damage, health, offence, defence, abilities"
									: "Power and Efficiency with the essence each unit feeds your wielder's spells priced in"
							}
						>
							{label}
						</button>
					))}
				</div>
				<p className="text-xs text-muted-foreground">
					Click a column header to sort. Best value per column is marked in
					gold. Use the ⚔ button to pick two units for a head-to-head duel.
				</p>
			</div>

			<p className="rounded-md border border-border bg-card/60 px-3 py-2 text-xs text-muted-foreground">
				<span className="font-semibold text-gold">Power &amp; Efficiency:</span>{" "}
				<em>Power</em> scores a full stack's combat strength — offensive output
				(damage × troop size × offence, plus ability modifiers) blended with
				survivability (health × defence). <em>Efficiency</em> is Power per 1,000
				gold of stack cost. Both are synthetic: 60 Power is roughly twice 30 Power,
				but neither is an in-game quantity.{" "}
				<span className="font-semibold text-foreground/90">Might</span> scores
				bodies alone;{" "}
				<span className="font-semibold text-foreground/90">Magic</span> prices in
				the essence a unit feeds your spells, which is what redeems the
				essence-heavy elites. Efficiency below the median for that unit's role (
				{EFF_MEDIAN[build].melee} melee, {EFF_MEDIAN[build].ranged} ranged) is
				dimmed. Both columns are already full-stack figures and ignore research, so
				they stay put across the per-unit, stack and max-potential modes; a gold{" "}
				<sup className="text-[9px] text-gold">B</sup> marks a unit re-scored while
				berserking, and unscored units show “—”. Numbers from the community{" "}
				<a
					className="underline decoration-dotted hover:text-gold"
					href="https://steamcommunity.com/app/867210/discussions/0/563659290304345947/"
					target="_blank"
					rel="noopener noreferrer"
				>
					Unit Comparison v4
				</a>{" "}
				sheet.
			</p>

			{scale === "max" && (
				<p className="rounded-md border border-gold/30 bg-gold/5 px-3 py-2 text-xs text-muted-foreground">
					<span className="font-semibold text-gold">Max potential:</span> every
					troop improvement researched, at the resulting max stack size — the
					ceiling with unlimited gold. Stack-size research is included (Rats
					100 → 160), and per-unit stats show their researched values. Sort any
					column to rank units at full investment. Units without research data
					show “—”.
				</p>
			)}
			{scale === "stack" && (
				<p className="rounded-md border border-gold/30 bg-gold/5 px-3 py-2 text-xs text-muted-foreground">
					<span className="font-semibold text-gold">Full stack totals:</span>{" "}
					cost, damage and HP are multiplied by each unit's max troop size, so a
					100-strong Rat stack is compared against a 40-strong Legionnaire
					stack. Offence, defence, movement, initiative and range are per-stack
					qualities and stay unchanged.
				</p>
			)}

			{picked.length > 0 && (
				<DuelPanel
					pair={picked
						.map((id) => rows.find((r) => r.id === id))
						.filter((r): r is Row => r !== undefined)
						.map((r) => scaleRow(r, scale))}
					onRemove={(id) => setPicked((p) => p.filter((x) => x !== id))}
					onClear={() => setPicked([])}
					scaled={scale === "stack"}
					build={build}
				/>
			)}

			<div className="overflow-x-auto rounded-lg border border-border shadow-soft">
				<table className="w-full min-w-[900px] border-collapse text-sm">
					<thead>
						<tr className="bg-secondary text-left">
							<th className="sticky left-0 bg-secondary px-2 py-2.5 font-display text-xs uppercase tracking-wider">
								<button
									type="button"
									className="hover:text-gold"
									onClick={() => toggleSort("name")}
								>
									Unit{sortKey === "name" ? (sortDir === 1 ? " ▲" : " ▼") : ""}
								</button>
							</th>
							{COLUMNS.map((c) => (
								<th
									key={c.key}
									title={
										scale === "stack" && SCALED_COLUMNS.has(c.key)
											? `${c.title} — full stack total`
											: c.title
									}
									className="px-2 py-2.5 font-display text-xs uppercase tracking-wider whitespace-nowrap"
								>
									<button
										type="button"
										className="hover:text-gold"
										onClick={() => toggleSort(c.key)}
									>
										{c.label}
										{scale === "stack" && SCALED_COLUMNS.has(c.key) && (
											<span className="ml-0.5 text-gold" title="full stack total">
												Σ
											</span>
										)}
										{sortKey === c.key ? (sortDir === 1 ? " ▲" : " ▼") : ""}
									</button>
								</th>
							))}
							<th className="px-2 py-2.5 font-display text-xs uppercase tracking-wider">
								Special
							</th>
							<th className="px-2 py-2.5 font-display text-xs uppercase tracking-wider">
								Ability
							</th>
						</tr>
					</thead>
					<tbody>
						{visible.map((r) => {
							const fs = factionStyles[r.faction];
							return (
								<tr
									key={r.id}
									className={`border-t border-border/60 border-l-2 ${fs.edge} odd:bg-card/40 hover:bg-accent/60 transition-colors`}
								>
									<td className="sticky left-0 bg-background/95 px-2 py-2">
										<div className="flex items-center gap-2.5">
											<button
												type="button"
												title={
													picked.includes(r.id)
														? "Remove from duel"
														: "Pick for duel"
												}
												aria-pressed={picked.includes(r.id)}
												className={`shrink-0 rounded border px-1.5 py-1 text-xs transition-colors ${
													picked.includes(r.id)
														? "border-gold bg-gold/20 text-gold"
														: "border-border text-muted-foreground hover:border-gold/60 hover:text-gold"
												}`}
												onClick={() => togglePick(r.id)}
											>
												⚔
											</button>
											{r.d.image && (
												<img
													src={`/images/units/${r.d.image}`}
													alt={r.d.name}
													className="h-10 w-10 rounded border border-border object-cover"
													loading="lazy"
												/>
											)}
											<div className="min-w-0">
												<div className="flex items-center gap-1.5 font-semibold whitespace-nowrap">
													{r.d.name}
													{r.tier === "upgraded" && (
														<span
															className="text-gold text-xs"
															title="Upgraded unit"
														>
															★
														</span>
													)}
												</div>
												<div className="flex items-center gap-1.5 text-xs">
													<span
														className={`rounded px-1 py-px text-[10px] font-semibold ${fs.badge}`}
													>
														{shortName(r.faction)}
													</span>
													<Essences list={r.d.essences} />
													<ResearchBadge
														uid={`${r.faction}|${r.baseName}`}
													/>
												</div>
											</div>
										</div>
									</td>
									{COLUMNS.map((c) => {
										const num = sortValue(r, c.key, build) as number;
										const isBest = best[c.key] !== undefined && num === best[c.key];
										return (
											<td
												key={c.key}
												className={`px-2 py-2 whitespace-nowrap tabular-nums ${
													isBest ? "font-bold text-gold" : ""
												}`}
											>
												{c.key === "power" || c.key === "eff" ? (
													<PowerCell r={r} build={build} field={c.key} />
												) : c.key === "cost" && r.unrated ? (
													"—"
												) : c.key === "cost" ? (
													<Cost cost={r.d.cost} />
												) : (
													cellValue(r, c.key)
												)}
											</td>
										);
									})}
									<td className="px-2 py-2 text-xs text-muted-foreground max-w-44">
										<AbilityTokens text={r.d.special} />
									</td>
									<td className="px-2 py-2 text-xs text-muted-foreground max-w-44">
										<AbilityTokens text={r.d.ability} />
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
		</div>
	);
}
