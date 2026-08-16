import { useMemo, useState } from "react";
import unitsRaw from "../data/units.json";

interface Tier {
	name: string;
	damage: string;
	health: string;
	offence: string;
	defence: string;
	image?: string | null;
	maxTroopSize?: string;
	house?: string;
}

interface UnitLine {
	faction: string;
	building: string;
	maxTroopSize: string;
	base: Tier;
	upgraded?: Tier;
	upgrades?: Tier[];
}

const units = unitsRaw as unknown as UnitLine[];
const FACTIONS = [...new Set(units.map((u) => u.faction))];

const tiersOf = (u: UnitLine) => [
	{ label: "Base", t: u.base },
	...(u.upgraded ? [{ label: "Upgraded", t: u.upgraded }] : []),
	...(u.upgrades ?? []).map((t) => ({ label: t.house ?? "Upgraded", t })),
];

/** "12-18" -> [12, 18]; "40" -> [40, 40] */
const damageRange = (s: string): [number, number] => {
	const [a, b] = s.split("-").map((n) => Number.parseInt(n, 10));
	return [a || 0, Number.isFinite(b) ? b : a || 0];
};

/** "5/17" -> {melee: 5, ranged: 17}; "12" -> {melee: 12, ranged: 0} */
const offenceOf = (s: string) => {
	const parts = s.split("/").map((n) => Number.parseInt(n, 10) || 0);
	return parts.length > 1
		? { melee: parts[0], ranged: parts[1] }
		: { melee: parts[0] ?? 0, ranged: 0 };
};

const num = (s: string | undefined) => Number.parseInt(s ?? "0", 10) || 0;

// Skill tables from the wiki. Index = skill level (0 = not taken).
const MELEE_SKILL = [0, 10, 20, 25];
const ARCHERY_SKILL = [0, 10, 20, 25];
const COMBAT_TRAINING = [0, 10, 20, 20];
const GUARD_SKILL = [0, 10, 20, 40];
const POSITIONING = [0, 15, 30, 30];

/** Offence-vs-Defence multiplier: +1%/pt when ahead, -0.5%/pt when behind, clamped 1/3..3. */
function ratingMultiplier(offence: number, defence: number) {
	const diff = offence - defence;
	const raw = diff >= 0 ? 1 + 0.01 * diff : 1 + 0.005 * diff;
	return Math.min(3, Math.max(1 / 3, raw));
}

function Segmented({
	value,
	onChange,
	options,
	label,
	hint,
}: {
	value: number;
	onChange: (v: number) => void;
	options: { v: number; label: string }[];
	label: string;
	hint?: string;
}) {
	return (
		<div className="flex items-center justify-between gap-3 py-1">
			<span className="text-xs text-muted-foreground" title={hint}>
				{label}
			</span>
			<span className="inline-flex overflow-hidden rounded border border-border">
				{options.map((o) => (
					<button
						key={o.v}
						type="button"
						onClick={() => onChange(o.v)}
						className={`px-2 py-0.5 text-xs tabular-nums transition-colors ${
							value === o.v
								? "bg-gold/20 font-semibold text-gold"
								: "bg-secondary text-muted-foreground hover:text-foreground"
						}`}
					>
						{o.label}
					</button>
				))}
			</span>
		</div>
	);
}

const LEVELS = [
	{ v: 0, label: "–" },
	{ v: 1, label: "1" },
	{ v: 2, label: "2" },
	{ v: 3, label: "3" },
];

function NumberRow({
	label,
	value,
	onChange,
	min = 0,
	step = 1,
	suffix,
	hint,
}: {
	label: string;
	value: number;
	onChange: (v: number) => void;
	min?: number;
	step?: number;
	suffix?: string;
	hint?: string;
}) {
	return (
		<label className="flex items-center justify-between gap-3 py-1">
			<span className="text-xs text-muted-foreground" title={hint}>
				{label}
			</span>
			<span className="inline-flex items-center gap-1">
				<input
					type="number"
					value={value}
					min={min}
					step={step}
					onChange={(e) => onChange(Number(e.target.value) || 0)}
					className="w-20 rounded border border-border bg-secondary px-2 py-0.5 text-right text-xs tabular-nums"
				/>
				{suffix && (
					<span className="w-6 text-xs text-muted-foreground">{suffix}</span>
				)}
			</span>
		</label>
	);
}

function UnitPicker({
	side,
	faction,
	setFaction,
	unitIdx,
	setUnitIdx,
	tierIdx,
	setTierIdx,
	count,
	setCount,
	tier,
	roster,
}: {
	side: string;
	faction: string;
	setFaction: (v: string) => void;
	unitIdx: number;
	setUnitIdx: (v: number) => void;
	tierIdx: number;
	setTierIdx: (v: number) => void;
	count: number;
	setCount: (v: number) => void;
	tier: Tier;
	roster: UnitLine[];
}) {
	const tierList = tiersOf(roster[unitIdx]);
	const selectClass =
		"w-full rounded border border-border bg-secondary px-2 py-1 text-sm";
	return (
		<div>
			<p className="font-display text-[11px] uppercase tracking-wider text-gold">
				{side}
			</p>
			<div className="mt-2 grid gap-2">
				<select
					className={selectClass}
					value={faction}
					onChange={(e) => {
						setFaction(e.target.value);
						setUnitIdx(0);
						setTierIdx(0);
					}}
				>
					{FACTIONS.map((f) => (
						<option key={f} value={f}>
							{f}
						</option>
					))}
				</select>
				<select
					className={selectClass}
					value={unitIdx}
					onChange={(e) => {
						setUnitIdx(Number(e.target.value));
						setTierIdx(0);
					}}
				>
					{roster.map((u, i) => (
						<option key={u.base.name} value={i}>
							{u.base.name}
						</option>
					))}
				</select>
				<div className="grid grid-cols-2 gap-2">
					<select
						className={selectClass}
						value={tierIdx}
						onChange={(e) => setTierIdx(Number(e.target.value))}
					>
						{tierList.map((t, i) => (
							<option key={t.t.name} value={i}>
								{t.t.name}
							</option>
						))}
					</select>
					<label className="flex items-center gap-2">
						<span className="text-xs text-muted-foreground">×</span>
						<input
							type="number"
							min={1}
							value={count}
							onChange={(e) =>
								setCount(Math.max(1, Number(e.target.value) || 1))
							}
							className="w-full rounded border border-border bg-secondary px-2 py-1 text-right text-sm tabular-nums"
						/>
					</label>
				</div>
			</div>
			<div className="mt-3 flex items-center gap-3">
				{tier.image && (
					<img
						src={`/images/units/${tier.image}`}
						alt={tier.name}
						className="h-12 w-12 rounded border border-border object-cover"
					/>
				)}
				<dl className="grid flex-1 grid-cols-2 gap-x-3 text-xs">
					<div className="flex justify-between gap-2">
						<dt className="text-muted-foreground">Damage</dt>
						<dd className="tabular-nums">{tier.damage || "—"}</dd>
					</div>
					<div className="flex justify-between gap-2">
						<dt className="text-muted-foreground">Health</dt>
						<dd className="tabular-nums">{tier.health || "—"}</dd>
					</div>
					<div className="flex justify-between gap-2">
						<dt className="text-muted-foreground">Offence</dt>
						<dd className="tabular-nums">{tier.offence || "—"}</dd>
					</div>
					<div className="flex justify-between gap-2">
						<dt className="text-muted-foreground">Defence</dt>
						<dd className="tabular-nums">{tier.defence || "—"}</dd>
					</div>
				</dl>
			</div>
		</div>
	);
}

const CHANNELING = [0, 30, 60, 100];
const MAGIC_RESISTANCE = [0, 25, 50, 75];

/** Spells skip the Offence/Defence comparison — only power and resistance apply. */
function SpellPanel() {
	const [base, setBase] = useState(100);
	const [channeling, setChanneling] = useState(0);
	const [magicRes, setMagicRes] = useState(0);
	const [keyword, setKeyword] = useState(false);

	const powerMult = 1 + CHANNELING[channeling] / 100;
	const resistMult =
		(1 - MAGIC_RESISTANCE[magicRes] / 100) * (keyword ? 0.5 : 1);
	const out = base * powerMult * resistMult;

	return (
		<div className="rounded-lg border border-border bg-card p-5 shadow-soft">
			<p className="font-display text-[11px] uppercase tracking-wider text-gold">
				Spell damage
			</p>
			<div className="mt-2 grid gap-4 md:grid-cols-3">
				<div>
					<NumberRow
						label="Spell base damage"
						value={base}
						onChange={setBase}
						step={10}
					/>
					<Segmented
						label="Channeling"
						hint="+30% / +60% / +100% Spell Damage Power"
						value={channeling}
						onChange={setChanneling}
						options={LEVELS}
					/>
				</div>
				<div>
					<Segmented
						label="Magic Resistance"
						hint="+25% / +50% / +75% Spell Damage Resistance"
						value={magicRes}
						onChange={setMagicRes}
						options={LEVELS}
					/>
					<div className="flex items-center justify-between gap-3 py-1">
						<span className="text-xs text-muted-foreground">Target keyword</span>
						<button
							type="button"
							onClick={() => setKeyword(!keyword)}
							title="Magic Resistance keyword: +50% Spell Damage Resistance"
							className={`rounded border px-2 py-0.5 text-xs transition-colors ${
								keyword
									? "border-gold/60 bg-gold/20 text-gold"
									: "border-border bg-secondary text-muted-foreground"
							}`}
						>
							Magic Resistance 50%
						</button>
					</div>
				</div>
				<div className="rounded border border-border/60 bg-secondary/50 p-3">
					<p className="text-2xl font-black tabular-nums">
						{out.toLocaleString(undefined, { maximumFractionDigits: 0 })}
						<span className="ml-2 text-xs font-normal text-muted-foreground">
							damage
						</span>
					</p>
					<p className="mt-1 text-xs tabular-nums text-muted-foreground">
						{base} × {powerMult.toFixed(2)} (power) × {resistMult.toFixed(2)}{" "}
						(resistance)
					</p>
				</div>
			</div>
		</div>
	);
}

export default function DamageCalculator() {
	const [atkFaction, setAtkFaction] = useState("Arleon");
	const [atkUnit, setAtkUnit] = useState(0);
	const [atkTier, setAtkTier] = useState(0);
	const [atkCount, setAtkCount] = useState(20);

	const [defFaction, setDefFaction] = useState("Rana");
	const [defUnit, setDefUnit] = useState(0);
	const [defTier, setDefTier] = useState(0);
	const [defCount, setDefCount] = useState(20);

	const [attackType, setAttackType] = useState<"melee" | "ranged">("melee");
	const [meleeSkill, setMeleeSkill] = useState(0);
	const [archerySkill, setArcherySkill] = useState(0);
	const [combatTraining, setCombatTraining] = useState(0);
	const [bonusOffence, setBonusOffence] = useState(0);
	const [bonusDamage, setBonusDamage] = useState(0);

	const [guardSkill, setGuardSkill] = useState(0);
	const [positioning, setPositioning] = useState(0);
	const [shielded, setShielded] = useState(false);
	const [defendStance, setDefendStance] = useState(false);
	const [bonusDefence, setBonusDefence] = useState(0);
	const [bonusResist, setBonusResist] = useState(0);
	const [situational, setSituational] = useState(100);

	const atkRoster = units.filter((u) => u.faction === atkFaction);
	const defRoster = units.filter((u) => u.faction === defFaction);
	const atk = tiersOf(atkRoster[atkUnit])[atkTier]?.t ?? atkRoster[atkUnit].base;
	const def = tiersOf(defRoster[defUnit])[defTier]?.t ?? defRoster[defUnit].base;

	const result = useMemo(() => {
		const [dmgMin, dmgMax] = damageRange(atk.damage);
		const off = offenceOf(atk.offence);

		const baseOffence = attackType === "melee" ? off.melee : off.ranged;
		const skillOffence =
			attackType === "melee"
				? MELEE_SKILL[meleeSkill]
				: ARCHERY_SKILL[archerySkill];
		const offence = baseOffence + skillOffence + bonusOffence;

		const defence =
			num(def.defence) + (defendStance ? 25 : 0) + bonusDefence;

		// Resistances on this layer are multiplied together (see the note under
		// the breakdown — how same-type sources actually stack is unconfirmed).
		const resistPcts = [
			attackType === "melee" ? GUARD_SKILL[guardSkill] : POSITIONING[positioning],
			attackType === "ranged" && shielded ? 50 : 0,
			bonusResist,
		].filter((p) => p > 0);
		const resistMult = resistPcts.reduce((m, p) => m * (1 - p / 100), 1);

		const rating = ratingMultiplier(offence, defence);
		const trainingMult = 1 + COMBAT_TRAINING[combatTraining] / 100;
		const situMult = situational / 100;

		const perUnit = (roll: number) => roll + bonusDamage;
		const stackBase = (roll: number) => perUnit(roll) * atkCount;
		const total = (roll: number) =>
			stackBase(roll) * rating * trainingMult * resistMult * situMult;

		const defHp = num(def.health) || 1;
		const kills = (dmg: number) =>
			Math.min(defCount, Math.floor(dmg / defHp));

		const avgRoll = (dmgMin + dmgMax) / 2;
		return {
			dmgMin,
			dmgMax,
			avgRoll,
			offence,
			baseOffence,
			skillOffence,
			defence,
			rating,
			trainingMult,
			resistMult,
			situMult,
			resistPcts,
			stackBase: stackBase(avgRoll),
			min: total(dmgMin),
			avg: total(avgRoll),
			max: total(dmgMax),
			killsAvg: kills(total(avgRoll)),
			killsMin: kills(total(dmgMin)),
			killsMax: kills(total(dmgMax)),
			defHp,
			// what one more point of each stat is worth right now
			perOffencePoint: offence >= defence ? 1 : 0.5,
			perDefencePoint: defence > offence ? 0.5 : 1,
			clamped: rating === 3 || rating === 1 / 3,
		};
	}, [
		atk,
		def,
		atkCount,
		defCount,
		attackType,
		meleeSkill,
		archerySkill,
		combatTraining,
		bonusOffence,
		bonusDamage,
		guardSkill,
		positioning,
		shielded,
		defendStance,
		bonusDefence,
		bonusResist,
		situational,
	]);

	const fmt = (n: number) =>
		n.toLocaleString(undefined, { maximumFractionDigits: 0 });
	const pct = (m: number) => `${m >= 1 ? "×" : "×"}${m.toFixed(2)}`;

	return (
		<div className="space-y-5">
		<div className="grid gap-5 lg:grid-cols-3">
			<div className="rounded-lg border border-border bg-card p-5 shadow-soft">
				<UnitPicker
					side="Attacker"
					faction={atkFaction}
					setFaction={setAtkFaction}
					unitIdx={atkUnit}
					setUnitIdx={setAtkUnit}
					tierIdx={atkTier}
					setTierIdx={setAtkTier}
					count={atkCount}
					setCount={setAtkCount}
					tier={atk}
					roster={atkRoster}
				/>
				<div className="mt-4 border-t border-border/60 pt-3">
					<Segmented
						label="Attack type"
						value={attackType === "melee" ? 0 : 1}
						onChange={(v) => setAttackType(v === 0 ? "melee" : "ranged")}
						options={[
							{ v: 0, label: "Melee" },
							{ v: 1, label: "Ranged" },
						]}
					/>
					{attackType === "melee" ? (
						<Segmented
							label="Melee skill"
							hint="+10 / +20 / +25 Melee Offence"
							value={meleeSkill}
							onChange={setMeleeSkill}
							options={LEVELS}
						/>
					) : (
						<Segmented
							label="Archery skill"
							hint="+10 / +20 / +25 Ranged Offence"
							value={archerySkill}
							onChange={setArcherySkill}
							options={LEVELS}
						/>
					)}
					<Segmented
						label="Combat Training"
						hint="+10% / +20% / +20% Damage"
						value={combatTraining}
						onChange={setCombatTraining}
						options={LEVELS}
					/>
					<NumberRow
						label="Other +Offence"
						hint="Cunning, artifacts, research, elevation…"
						value={bonusOffence}
						onChange={setBonusOffence}
						min={-100}
					/>
					<NumberRow
						label="Other +Damage / unit"
						hint="Brutal, Strengthen, research"
						value={bonusDamage}
						onChange={setBonusDamage}
						min={-10}
					/>
				</div>
			</div>

			<div className="rounded-lg border border-border bg-card p-5 shadow-soft">
				<UnitPicker
					side="Defender"
					faction={defFaction}
					setFaction={setDefFaction}
					unitIdx={defUnit}
					setUnitIdx={setDefUnit}
					tierIdx={defTier}
					setTierIdx={setDefTier}
					count={defCount}
					setCount={setDefCount}
					tier={def}
					roster={defRoster}
				/>
				<div className="mt-4 border-t border-border/60 pt-3">
					{attackType === "melee" ? (
						<Segmented
							label="Guard skill"
							hint="+10% / +20% / +40% Melee Resistance"
							value={guardSkill}
							onChange={setGuardSkill}
							options={LEVELS}
						/>
					) : (
						<Segmented
							label="Positioning"
							hint="+15% / +30% / +30% Ranged Resistance"
							value={positioning}
							onChange={setPositioning}
							options={LEVELS}
						/>
					)}
					<div className="flex items-center justify-between gap-3 py-1">
						<span className="text-xs text-muted-foreground">Stance / keyword</span>
						<span className="flex gap-1">
							<button
								type="button"
								onClick={() => setDefendStance(!defendStance)}
								title="Defend: +25 Defence"
								className={`rounded border px-2 py-0.5 text-xs transition-colors ${
									defendStance
										? "border-gold/60 bg-gold/20 text-gold"
										: "border-border bg-secondary text-muted-foreground"
								}`}
							>
								Defend +25
							</button>
							{attackType === "ranged" && (
								<button
									type="button"
									onClick={() => setShielded(!shielded)}
									title="Shielded: +50% Ranged Resistance"
									className={`rounded border px-2 py-0.5 text-xs transition-colors ${
										shielded
											? "border-gold/60 bg-gold/20 text-gold"
											: "border-border bg-secondary text-muted-foreground"
									}`}
								>
									Shielded 50%
								</button>
							)}
						</span>
					</div>
					<NumberRow
						label="Other +Defence"
						hint="Guard keyword (+10), Protect (+25), artifacts, elevation…"
						value={bonusDefence}
						onChange={setBonusDefence}
						min={-100}
					/>
					<NumberRow
						label="Other resistance"
						hint="Ethereal, Essence Shield, essence scales…"
						value={bonusResist}
						onChange={setBonusResist}
						min={0}
						suffix="%"
					/>
					<NumberRow
						label="Situational"
						hint="Anything else multiplying the hit — e.g. shooting past deadly range, or after moving. Exact values aren't documented; 100% = none."
						value={situational}
						onChange={setSituational}
						min={0}
						step={5}
						suffix="%"
					/>
				</div>
			</div>

			<div className="rounded-lg border border-gold/40 bg-card p-5 shadow-soft">
				<p className="font-display text-[11px] uppercase tracking-wider text-gold">
					One attack
				</p>

				{atk.damage && result.baseOffence === 0 && (
					<p className="mt-2 rounded border border-border/60 bg-secondary/50 p-2 text-xs text-muted-foreground">
						{atk.name} has no {attackType} attack — its {attackType} Offence is
						0, so this is a hypothetical.
					</p>
				)}
				{(!atk.damage || !def.health) && (
					<p className="mt-2 rounded border border-border/60 bg-secondary/50 p-2 text-xs text-muted-foreground">
						The wiki has no stats for{" "}
						{!atk.damage ? atk.name : def.name} yet, so this matchup can't be
						calculated.
					</p>
				)}

				<p className="mt-2 text-3xl font-black tabular-nums">
					{fmt(result.avg)}
					<span className="ml-2 text-sm font-normal text-muted-foreground">
						damage (avg)
					</span>
				</p>
				<p className="text-xs text-muted-foreground tabular-nums">
					range {fmt(result.min)} – {fmt(result.max)}
				</p>

				<p className="mt-3 text-2xl font-bold tabular-nums text-gold">
					{result.killsAvg}
					<span className="ml-2 text-sm font-normal text-muted-foreground">
						of {defCount} {def.name} killed
					</span>
				</p>
				<p className="text-xs text-muted-foreground tabular-nums">
					{result.killsMin} – {result.killsMax} depending on the roll ·{" "}
					{result.defHp} HP each
				</p>

				<div className="mt-4 space-y-1 border-t border-border/60 pt-3 text-xs">
					<div className="flex justify-between gap-2">
						<span className="text-muted-foreground">
							Base {result.dmgMin}–{result.dmgMax}
							{bonusDamage !== 0 && ` ${bonusDamage > 0 ? "+" : ""}${bonusDamage}`}{" "}
							× {atkCount}
						</span>
						<span className="tabular-nums">{fmt(result.stackBase)}</span>
					</div>
					<div className="flex justify-between gap-2">
						<span className="text-muted-foreground">
							Offence {result.offence} vs Defence {result.defence}
							{result.clamped && " (clamped)"}
						</span>
						<span className="tabular-nums">{pct(result.rating)}</span>
					</div>
					<div className="flex justify-between gap-2">
						<span className="text-muted-foreground">Combat Training</span>
						<span className="tabular-nums">{pct(result.trainingMult)}</span>
					</div>
					<div className="flex justify-between gap-2">
						<span className="text-muted-foreground">
							Resistance{" "}
							{result.resistPcts.length > 1 &&
								`(${result.resistPcts.join("% × ")}%)`}
						</span>
						<span className="tabular-nums">{pct(result.resistMult)}</span>
					</div>
					{result.situMult !== 1 && (
						<div className="flex justify-between gap-2">
							<span className="text-muted-foreground">Situational</span>
							<span className="tabular-nums">{pct(result.situMult)}</span>
						</div>
					)}
				</div>

				<div className="mt-4 rounded border border-border/60 bg-secondary/50 p-3 text-xs leading-relaxed">
					<p className="font-semibold text-foreground">At this matchup</p>
					<p className="mt-1 text-muted-foreground">
						You are {result.offence >= result.defence ? "ahead" : "behind"} on
						the rating by{" "}
						<span className="tabular-nums text-foreground">
							{Math.abs(result.offence - result.defence)}
						</span>{" "}
						{Math.abs(result.offence - result.defence) === 1 ? "point" : "points"},
						so the next <span className="tabular-nums">+1 Offence</span>{" "}
						is worth{" "}
						<span className="tabular-nums text-foreground">
							{result.perOffencePoint}%
						</span>{" "}
						more damage, and <span className="tabular-nums">+1 Defence</span> on
						the target is worth{" "}
						<span className="tabular-nums text-foreground">
							{result.perDefencePoint === 1 ? "1" : "0.5"}%
						</span>{" "}
						less.
						{result.clamped &&
							" The rating is at its clamp, so more of it does nothing until the gap closes."}
					</p>
				</div>
			</div>
		</div>
		<SpellPanel />
		</div>
	);
}
