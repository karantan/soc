import { useMemo, useState } from "react";
import {
	type Army,
	type Battery,
	batteries,
	batteryOf,
	bestFor,
	castOf,
	ESSENCE_WIELDERS,
	income,
	MAGIC_SKILL_ESSENCE,
	noSkills,
	type SkillLevels,
	spells,
} from "../data/essence";
import { factions } from "../data/factions";
import { factionStyles } from "../data/factionStyles";
import { type School, SCHOOL_LABEL, SCHOOLS } from "../data/unitPower";

/**
 * The army-level essence view.
 *
 * Every other score on this site rates one stack alone. Essence does not work
 * that way: a stack generates its essence once per round regardless of troop
 * count, the whole army pools it, and spells draw from that pool at fixed
 * costs. So this page asks the question the per-unit numbers cannot: with
 * these slots and this wielder, what can you actually cast, and how often?
 */

const seg = (on: boolean) =>
	`rounded-md px-2 py-1 text-xs font-display uppercase tracking-wider transition-colors ${
		on
			? "bg-gold/20 text-gold font-bold"
			: "text-muted-foreground hover:text-foreground"
	}`;

const SCHOOL_DOT: Record<School, string> = {
	order: "bg-sky-300",
	chaos: "bg-rose-400",
	creation: "bg-emerald-400",
	destruction: "bg-orange-400",
	arcana: "bg-violet-400",
};

const SCHOOL_TEXT: Record<School, string> = {
	order: "text-sky-300",
	chaos: "text-rose-400",
	creation: "text-emerald-400",
	destruction: "text-orange-400",
	arcana: "text-violet-400",
};

function Pips({ essences }: { essences: Record<School, number> }) {
	const pips = SCHOOLS.flatMap((s) =>
		Array.from({ length: essences[s] }, (_, i) => (
			<span
				// biome-ignore lint/suspicious/noArrayIndexKey: pips of one school are interchangeable; the list only changes length, never order
				key={`${s}-${i}`}
				className={`inline-block h-2 w-2 rounded-full ${SCHOOL_DOT[s]}`}
				title={SCHOOL_LABEL[s]}
			/>
		)),
	);
	return pips.length ? (
		<span className="inline-flex items-center gap-0.5">{pips}</span>
	) : (
		<span className="text-[10px] text-muted-foreground">no essence</span>
	);
}

const rounds = (n: number) =>
	!Number.isFinite(n)
		? "never"
		: n <= 1
			? "every round"
			: `every ${n.toLocaleString("en-US", { maximumFractionDigits: 1 })} rounds`;

const goldOf = (b: Battery) =>
	`${b.gold.toLocaleString("en-US")}g${b.rare ? ` + ${b.rare} rare` : ""}`;

export default function EssencePlanner() {
	const [slotCount, setSlotCount] = useState(6);
	const [slots, setSlots] = useState<(string | null)[]>(Array(8).fill(null));
	const [charging, setCharging] = useState<boolean[]>(Array(8).fill(false));
	const [skills, setSkills] = useState<SkillLevels>(noSkills());
	const [wielderKey, setWielderKey] = useState("");
	const [faction, setFaction] = useState("all");
	const [query, setQuery] = useState("");
	const [target, setTarget] = useState<string | null>(null);

	const wielder = ESSENCE_WIELDERS.find((w) => `${w.faction}|${w.name}` === wielderKey);
	const army: Army = useMemo(
		() => ({
			slots: slots.slice(0, slotCount),
			charging: charging.slice(0, slotCount),
			skills,
			spec: wielder ? { school: wielder.school, amount: wielder.amount } : null,
		}),
		[slots, charging, slotCount, skills, wielder],
	);
	const inc = useMemo(() => income(army), [army]);

	const armyFactions = useMemo(
		() =>
			[...new Set(army.slots.map((k) => (k ? batteryOf.get(k)?.faction : null)))].filter(
				(f): f is string => Boolean(f),
			),
		[army.slots],
	);

	const ranked = useMemo(
		() =>
			spells
				.map((sp) => ({ sp, cast: castOf(sp, army, inc) }))
				.sort((a, b) => {
					const live = (x: typeof a) => (x.cast.tier > 0 && Number.isFinite(x.cast.rounds) ? 0 : 1);
					return live(a) - live(b) || a.cast.rounds - b.cast.rounds || a.sp.totalCost - b.sp.totalCost;
				}),
		[army, inc],
	);

	const targetRow = ranked.find((r) => r.sp.name === target);

	const setSlot = (i: number, key: string | null) =>
		setSlots((s) => s.map((x, j) => (j === i ? key : x)));

	const addUnit = (key: string) => {
		const free = slots.slice(0, slotCount).indexOf(null);
		setSlot(free === -1 ? slotCount - 1 : free, key);
	};

	const picker = useMemo(() => {
		const q = query.trim().toLowerCase();
		return batteries
			.filter(
				(b) =>
					(faction === "all" || b.faction === faction) &&
					(!q || b.name.toLowerCase().includes(q)),
			)
			.sort((a, b) => b.total - a.total || a.gold - b.gold || a.name.localeCompare(b.name));
	}, [faction, query]);

	return (
		<div className="space-y-6">
			{/* ---- slots ---- */}
			<section>
				<div className="mb-2 flex flex-wrap items-center gap-3">
					<h2 className="font-display text-sm font-bold uppercase tracking-wider text-gold">
						Your army
					</h2>
					<div className="flex items-center gap-1 rounded-lg border border-gold/40 bg-card p-1">
						<span className="px-1.5 font-display text-[10px] uppercase tracking-wider text-muted-foreground">
							Slots
						</span>
						{[4, 5, 6, 7, 8].map((n) => (
							<button key={n} type="button" className={seg(slotCount === n)} onClick={() => setSlotCount(n)}>
								{n}
							</button>
						))}
					</div>
					{army.slots.some(Boolean) && (
						<button
							type="button"
							className="text-xs text-muted-foreground underline hover:text-gold"
							onClick={() => {
								setSlots(Array(8).fill(null));
								setCharging(Array(8).fill(false));
							}}
						>
							clear all
						</button>
					)}
				</div>
				<div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8">
					{Array.from({ length: slotCount }, (_, i) => {
						const b = slots[i] ? batteryOf.get(slots[i] as string) : undefined;
						if (!b)
							return (
								<div
									// biome-ignore lint/suspicious/noArrayIndexKey: the index is the slot
									key={`slot-${i}`}
									className="flex h-[86px] items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground"
								>
									empty slot
								</div>
							);
						const fs = factionStyles[b.faction];
						return (
							<div
								// biome-ignore lint/suspicious/noArrayIndexKey: the index is the slot
								key={`slot-${i}`}
								className="flex h-[86px] flex-col justify-between rounded-lg border border-gold/40 bg-card p-2"
							>
								<div className="flex items-start justify-between gap-1">
									<span className="text-xs font-semibold leading-tight">{b.name}</span>
									<button
										type="button"
										className="text-xs text-muted-foreground hover:text-gold"
										title="Empty this slot"
										onClick={() => setSlot(i, null)}
									>
										×
									</button>
								</div>
								<div className="flex items-center justify-between gap-1">
									<span className={`rounded px-1 text-[9px] font-semibold ${fs.badge}`}>
										{b.faction.replace("Barony of ", "")}
									</span>
									<Pips essences={b.essences} />
								</div>
								{b.charge ? (
									<button
										type="button"
										className={`rounded px-1 py-0.5 text-[9px] uppercase tracking-wide ${
											charging[i]
												? "bg-gold/20 font-bold text-gold"
												: "text-muted-foreground hover:text-foreground"
										}`}
										title="Spend this stack's turn on Charge Essence, generating its essence a second time"
										onClick={() => setCharging((c) => c.map((x, j) => (j === i ? !x : x)))}
									>
										{charging[i] ? "charging ×2" : "charge essence"}
									</button>
								) : (
									<span className="text-[9px] text-muted-foreground">{goldOf(b)}</span>
								)}
							</div>
						);
					})}
				</div>
			</section>

			{/* ---- wielder ---- */}
			<section className="rounded-lg border border-border bg-card p-3">
				<h2 className="mb-2 font-display text-sm font-bold uppercase tracking-wider text-gold">
					Wielder
				</h2>
				<div className="flex flex-wrap items-center gap-x-4 gap-y-2">
					<label className="flex items-center gap-2 text-xs text-muted-foreground">
						Specialization
						<select
							className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
							value={wielderKey}
							onChange={(e) => setWielderKey(e.target.value)}
						>
							<option value="">none</option>
							{ESSENCE_WIELDERS.map((w) => (
								<option key={`${w.faction}|${w.name}`} value={`${w.faction}|${w.name}`}>
									{w.name} (+{w.amount} {SCHOOL_LABEL[w.school]})
								</option>
							))}
						</select>
					</label>
					{SCHOOLS.map((s) => (
						<div key={s} className="flex items-center gap-1 rounded-lg border border-border p-1">
							<span className={`px-1 font-display text-[10px] uppercase tracking-wider ${SCHOOL_TEXT[s]}`}>
								{SCHOOL_LABEL[s]}
							</span>
							{([0, 1, 2, 3] as const).map((lv) => (
								<button
									key={lv}
									type="button"
									className={seg(skills[s] === lv)}
									title={
										lv === 0
											? `No ${SCHOOL_LABEL[s]} Magic: its spells are locked`
											: `${SCHOOL_LABEL[s]} Magic ${lv}: +${MAGIC_SKILL_ESSENCE} essence a round, tier ${lv} spells`
									}
									onClick={() => setSkills((k) => ({ ...k, [s]: lv }))}
								>
									{lv === 0 ? "–" : lv}
								</button>
							))}
						</div>
					))}
				</div>
				<p className="mt-2 text-xs text-muted-foreground">
					A school's magic skill grants +{MAGIC_SKILL_ESSENCE} essence a round at
					every level; what the levels buy is the spell tier. Level 0 locks that
					school's spells entirely, and a dyad needs both of its schools, so it
					casts at the lower of the two.
				</p>
			</section>

			{/* ---- income ---- */}
			<section className="rounded-lg border border-gold/40 bg-gold/5 p-3">
				<h2 className="mb-2 font-display text-sm font-bold uppercase tracking-wider text-gold">
					Essence a round
				</h2>
				<div className="flex flex-wrap gap-3">
					{SCHOOLS.map((s) => {
						const fromTroops = army.slots.reduce((n, key, i) => {
							const b = key ? batteryOf.get(key) : undefined;
							return n + (b ? b.essences[s] * (army.charging[i] && b.charge ? 2 : 1) : 0);
						}, 0);
						const fromSkill = skills[s] > 0 ? MAGIC_SKILL_ESSENCE : 0;
						const fromSpec = wielder?.school === s ? wielder.amount : 0;
						return (
							<div
								key={s}
								className={`min-w-[7.5rem] rounded-md border border-border bg-card px-3 py-2 ${
									inc[s] ? "" : "opacity-50"
								}`}
							>
								<div className={`font-display text-[10px] uppercase tracking-wider ${SCHOOL_TEXT[s]}`}>
									{SCHOOL_LABEL[s]}
								</div>
								<div className="text-2xl font-bold tabular-nums">{inc[s]}</div>
								<div className="text-[10px] text-muted-foreground">
									{fromTroops} troops
									{fromSkill ? ` + ${fromSkill} skill` : ""}
									{fromSpec ? ` + ${fromSpec} spec` : ""}
								</div>
							</div>
						);
					})}
				</div>
			</section>

			{/* ---- target spell ---- */}
			{targetRow && (
				<section className="rounded-lg border border-gold/40 bg-card p-3">
					<div className="flex items-start justify-between gap-3">
						<h2 className="font-display text-sm font-bold uppercase tracking-wider text-gold">
							{targetRow.sp.name}
						</h2>
						<button
							type="button"
							className="text-xs text-muted-foreground underline hover:text-foreground"
							onClick={() => setTarget(null)}
						>
							clear
						</button>
					</div>
					<p className="mt-1 text-sm">
						Costs{" "}
						{targetRow.sp.schools.map((s, i) => (
							<span key={s}>
								{i > 0 && " + "}
								<span className={SCHOOL_TEXT[s]}>
									{targetRow.sp.essences[s]} {SCHOOL_LABEL[s]}
								</span>
							</span>
						))}
						.{" "}
						{targetRow.cast.tier === 0 ? (
							<span className="text-orange-400">
								Locked: you need{" "}
								{targetRow.sp.schools
									.filter((s) => skills[s] === 0)
									.map((s) => `${SCHOOL_LABEL[s]} Magic`)
									.join(" and ")}
								.
							</span>
						) : !Number.isFinite(targetRow.cast.rounds) ? (
							<span className="text-orange-400">
								You generate no {SCHOOL_LABEL[targetRow.cast.binding as School]} at all.
							</span>
						) : (
							<>
								You cast it{" "}
								<span className="font-bold text-gold">{rounds(targetRow.cast.rounds)}</span> at
								tier {targetRow.cast.tier}, first on turn {targetRow.cast.firstCast}.
							</>
						)}
					</p>
					{targetRow.cast.binding && targetRow.cast.shortBy > 0 && (
						<>
							<p className="mt-2 text-sm">
								To cast it <em>every</em> round you need{" "}
								<span className="font-bold text-gold">
									{targetRow.cast.shortBy} more{" "}
									{SCHOOL_LABEL[targetRow.cast.binding]}
								</span>{" "}
								a round, from {army.slots.slice(0, slotCount).filter((s) => s === null).length}{" "}
								empty {army.slots.slice(0, slotCount).filter((s) => s === null).length === 1 ? "slot" : "slots"}.
							</p>
							<div className="mt-2 flex flex-wrap gap-1.5">
								{bestFor(targetRow.cast.binding, armyFactions)
									.slice(0, 8)
									.map((b) => {
										const per = b.essences[targetRow.cast.binding as School];
										return (
											<button
												key={b.key}
												type="button"
												className="rounded-md border border-border bg-background px-2 py-1 text-xs hover:border-gold/60"
												title={`Add a stack of ${b.name} to your army`}
												onClick={() => addUnit(b.key)}
											>
												<span className="font-semibold">{b.name}</span>{" "}
												<span className={SCHOOL_TEXT[targetRow.cast.binding as School]}>
													+{per}
												</span>{" "}
												<span className="text-muted-foreground">
													{goldOf(b)} · {Math.ceil(targetRow.cast.shortBy / per)} stack
													{Math.ceil(targetRow.cast.shortBy / per) === 1 ? "" : "s"} covers it
												</span>
											</button>
										);
									})}
							</div>
						</>
					)}
				</section>
			)}

			{/* ---- spells ---- */}
			<section>
				<h2 className="mb-2 font-display text-sm font-bold uppercase tracking-wider text-gold">
					What you can cast
				</h2>
				<div className="overflow-x-auto rounded-lg border border-border">
					<table className="w-full min-w-[46rem] text-sm">
						<thead className="bg-card text-[10px] uppercase tracking-wider text-muted-foreground">
							<tr>
								<th className="px-3 py-2 text-left font-display">Spell</th>
								<th className="px-3 py-2 text-left font-display">Cost</th>
								<th className="px-3 py-2 text-right font-display">Tier</th>
								<th className="px-3 py-2 text-left font-display">Cadence</th>
								<th className="px-3 py-2 text-left font-display">At your tier</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-border/50">
							{ranked.map(({ sp, cast }) => {
								const live = cast.tier > 0 && Number.isFinite(cast.rounds);
								return (
									<tr
										key={sp.name}
										className={`cursor-pointer hover:bg-gold/5 ${live ? "" : "opacity-45"} ${
											target === sp.name ? "bg-gold/10" : ""
										}`}
										onClick={() => setTarget(target === sp.name ? null : sp.name)}
									>
										<td className="px-3 py-1.5 font-semibold">{sp.name}</td>
										<td className="px-3 py-1.5 whitespace-nowrap">
											{sp.schools.map((s, i) => (
												<span key={s}>
													{i > 0 && <span className="text-muted-foreground"> + </span>}
													<span className={SCHOOL_TEXT[s]}>{sp.essences[s]}</span>
												</span>
											))}
											<span className="ml-1 text-[10px] text-muted-foreground">
												{sp.schools.map((s) => SCHOOL_LABEL[s]).join(" / ")}
											</span>
										</td>
										<td className="px-3 py-1.5 text-right tabular-nums">
											{cast.tier === 0 ? (
												<span className="text-muted-foreground">locked</span>
											) : (
												`T${cast.tier}`
											)}
										</td>
										<td
											className={`px-3 py-1.5 whitespace-nowrap ${
												live && cast.rounds <= 1 ? "font-bold text-gold" : ""
											}`}
										>
											{cast.tier === 0 ? "—" : rounds(cast.rounds)}
										</td>
										<td className="px-3 py-1.5 text-xs text-muted-foreground">
											{cast.tier > 0 ? sp.tiers[cast.tier - 1] : sp.tiers[0]}
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			</section>

			{/* ---- unit picker ---- */}
			<section>
				<div className="mb-2 flex flex-wrap items-center gap-2">
					<h2 className="font-display text-sm font-bold uppercase tracking-wider text-gold">
						Add a stack
					</h2>
					<div className="flex flex-wrap items-center gap-1 rounded-lg border border-gold/40 bg-card p-1">
						<button type="button" className={seg(faction === "all")} onClick={() => setFaction("all")}>
							All
						</button>
						{factions.map((f) => (
							<button
								key={f.name}
								type="button"
								className={seg(faction === f.name)}
								onClick={() => setFaction(f.name)}
							>
								{f.shortName}
							</button>
						))}
					</div>
					<input
						type="search"
						placeholder="search units"
						className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
					/>
				</div>
				<div className="grid max-h-80 grid-cols-2 gap-1.5 overflow-y-auto rounded-lg border border-border p-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
					{picker.map((b) => (
						<button
							key={b.key}
							type="button"
							className={`flex flex-col gap-1 rounded-md border border-border bg-card px-2 py-1.5 text-left hover:border-gold/60 ${
								b.total ? "" : "opacity-50"
							}`}
							onClick={() => addUnit(b.key)}
						>
							<span className="text-xs font-semibold leading-tight">{b.name}</span>
							<span className="flex items-center justify-between gap-1">
								<Pips essences={b.essences} />
								<span className="text-[9px] text-muted-foreground">{goldOf(b)}</span>
							</span>
						</button>
					))}
				</div>
			</section>
		</div>
	);
}
