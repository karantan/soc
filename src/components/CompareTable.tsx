import { useMemo, useState } from "react";
import { factions } from "../data/factions";
import { factionStyles } from "../data/factionStyles";
import unitsRaw from "../data/units.json";
import { AbilityTokens } from "./Tip";

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
	note?: string;
}

interface Row {
	id: string;
	faction: string;
	tier: Tier;
	maxTroopSize: string;
	building: string;
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
			d: u.upgraded,
		});
	}
	return out;
});

const firstNum = (s: string) => {
	const m = s.match(/\d+/);
	return m ? Number(m[0]) : 0;
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
	| "maxTroopSize";

const sortValue = (r: Row, key: SortKey): number | string => {
	switch (key) {
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
	}
};

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
];

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
	{ key: "special", label: "Special", numeric: false },
	{ key: "ability", label: "Ability", numeric: false },
	{ key: "building", label: "Building", numeric: false },
];

function DuelPanel({
	pair,
	onRemove,
	onClear,
}: {
	pair: Row[];
	onRemove: (id: string) => void;
	onClear: () => void;
}) {
	const [a, b] = pair;
	const text = (r: Row, key: string): string => {
		if (key === "special") return r.d.special || "—";
		if (key === "ability") return r.d.ability || "—";
		if (key === "building") return r.building || "—";
		if (key === "maxTroopSize") return r.maxTroopSize;
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
								const va = sortValue(a, st.key as SortKey) as number;
								const vb = sortValue(b, st.key as SortKey) as number;
								if (va !== vb && va > 0 && vb > 0) {
									const aBetter = st.lowerBetter ? va < vb : va > vb;
									winA = aBetter;
									winB = !aBetter;
								}
							}
							const render = (r: Row) => {
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

	const togglePick = (id: string) => {
		setPicked((p) => {
			if (p.includes(id)) return p.filter((x) => x !== id);
			if (p.length >= 2) return [p[1], id]; // replace the oldest pick
			return [...p, id];
		});
	};

	const visible = useMemo(() => {
		let out = rows.filter(
			(r) =>
				(factionFilter === "all" || r.faction === factionFilter) &&
				(tierFilter === "both" || r.tier === tierFilter),
		);
		if (sortKey) {
			out = [...out].sort((a, b) => {
				const va = sortValue(a, sortKey);
				const vb = sortValue(b, sortKey);
				if (typeof va === "string" || typeof vb === "string")
					return String(va).localeCompare(String(vb)) * sortDir;
				return (va - vb) * sortDir;
			});
		}
		return out;
	}, [factionFilter, tierFilter, sortKey, sortDir]);

	// best (max) value per numeric column among visible rows; for cost, best = lowest
	const best = useMemo(() => {
		const b: Partial<Record<SortKey, number>> = {};
		for (const col of COLUMNS) {
			const vals = visible
				.map((r) => sortValue(r, col.key) as number)
				.filter((v) => v > 0);
			if (vals.length > 1)
				b[col.key] = col.key === "cost" ? Math.min(...vals) : Math.max(...vals);
		}
		return b;
	}, [visible]);

	const toggleSort = (key: SortKey) => {
		if (sortKey === key) {
			setSortDir((d) => (d === 1 ? -1 : 1));
		} else {
			setSortKey(key);
			setSortDir(key === "cost" || key === "name" ? 1 : -1);
		}
	};

	const cellValue = (r: Row, key: SortKey): string => {
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
				<p className="text-xs text-muted-foreground">
					Click a column header to sort. Best value per column is marked in
					gold. Use the ⚔ button to pick two units for a head-to-head duel.
				</p>
			</div>

			{picked.length > 0 && (
				<DuelPanel
					pair={picked
						.map((id) => rows.find((r) => r.id === id))
						.filter((r): r is Row => r !== undefined)}
					onRemove={(id) => setPicked((p) => p.filter((x) => x !== id))}
					onClear={() => setPicked([])}
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
									title={c.title}
									className="px-2 py-2.5 font-display text-xs uppercase tracking-wider whitespace-nowrap"
								>
									<button
										type="button"
										className="hover:text-gold"
										onClick={() => toggleSort(c.key)}
									>
										{c.label}
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
												</div>
											</div>
										</div>
									</td>
									{COLUMNS.map((c) => {
										const num = sortValue(r, c.key) as number;
										const isBest = best[c.key] !== undefined && num === best[c.key];
										return (
											<td
												key={c.key}
												className={`px-2 py-2 whitespace-nowrap tabular-nums ${
													isBest ? "font-bold text-gold" : ""
												}`}
											>
												{c.key === "cost" ? (
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
