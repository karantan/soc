import { useMemo, useState } from "react";
import classPoolsRaw from "../data/classPools.json";
import { factions } from "../data/factions";
import { factionStyles } from "../data/factionStyles";
import skillDataRaw from "../data/skillDescriptions.json";
import { type PatchNote } from "./PatchChip";
import { SkillNote } from "./SkillNote";
import { Tip } from "./Tip";

interface RequirePath {
	requireType: string | null;
	requires: { name: string; level: number }[];
}

interface PoolSkill {
	name: string;
	slug: string;
	/** Alternative prerequisite routes; empty means always offerable. */
	paths: RequirePath[];
}

interface Pool {
	name: string;
	min: number;
	max: number;
	interval: number | null;
	skills: PoolSkill[];
}

interface ClassPool {
	faction: string;
	class: string;
	pools: Pool[];
	wielders: string[];
}

const classPools = classPoolsRaw as ClassPool[];

const skillData = skillDataRaw as {
	skills: Record<string, string[]>;
	powers: Record<string, string[]>;
	icons: Record<string, string>;
	notes: Record<string, string>;
};

const factionOrder = factions.map((f) => f.name);
const sorted = [...classPools].sort(
	(a, b) =>
		factionOrder.indexOf(a.faction) - factionOrder.indexOf(b.faction) ||
		a.class.localeCompare(b.class),
);

const poolLabel = (p: Pool) => {
	if (p.name.includes("Power")) return "Powers (every 8th level)";
	if (p.max >= 99) return `Level ${p.min}+`;
	return `Level ${p.min <= 1 ? 1 : p.min}–${p.max}`;
};

function SkillEntry({ s, patches }: { s: PoolSkill; patches?: PatchNote[] }) {
	const levels = skillData.skills[s.name] ?? skillData.powers[s.name];
	const icon = skillData.icons[s.name];
	const note = skillData.notes[s.name];
	const gated = s.paths.length > 0;
	const describe = (p: RequirePath) =>
		(p.requireType === "RequireAll" && p.requires.length > 1
			? "all of: "
			: p.requires.length > 1
				? "any of: "
				: "") +
		p.requires
			.map((r) => `${r.name}${r.level > 1 ? ` level ${r.level}` : ""}`)
			.join(", ");
	return (
		<Tip
			label={
				<span
					className={`inline-flex w-full cursor-help items-center gap-2 rounded border px-2 py-1 text-sm transition-colors hover:border-gold/60 ${
						gated
							? "border-border/60 bg-secondary/50 text-muted-foreground"
							: "border-border bg-secondary"
					}`}
				>
					{icon && (
						<img
							src={`/images/skills/${icon}`}
							alt=""
							className="h-6 w-6 rounded-sm"
							loading="lazy"
						/>
					)}
					<span className="truncate">{s.name}</span>
					{gated && (
						<span className="ml-auto text-xs text-gold/70" title="Has prerequisites">
							🔒
						</span>
					)}
				</span>
			}
			className="block"
		>
			<span className="font-display font-bold text-gold">{s.name}</span>
			{gated && (
				<span className="mt-1 block text-gold/90">
					Requires {describe(s.paths[0])}
					{s.paths.slice(1).map((p) => (
						<span key={describe(p)} className="block">
							<span className="text-muted-foreground">or</span> {describe(p)}
						</span>
					))}
				</span>
			)}
			{levels?.map((effect, i) => (
				<span key={`${s.name}-l${i + 1}`} className="mt-1 block">
					<span className="font-semibold text-foreground/80">
						Level {i + 1}:
					</span>{" "}
					{effect}
				</span>
			))}
			{note && <SkillNote note={note} />}
			{patches?.length ? (
				<span className="mt-2 block border-t border-border/60 pt-1.5">
					{patches.map((p) => (
						<span key={`${p.label}-${p.text}`} className="mt-1 block first:mt-0">
							<span className="font-semibold text-gold/80">{p.label}</span>{" "}
							<span className="text-muted-foreground">{p.text}</span>
						</span>
					))}
				</span>
			) : null}
		</Tip>
	);
}

export default function ClassPools({
	skillPatches = {},
}: {
	skillPatches?: Record<string, PatchNote[]>;
}) {
	const [selected, setSelected] = useState(0);
	const cls = sorted[selected];

	const pools = useMemo(() => {
		const order = (p: Pool) => (p.name.includes("Power") ? 999 : p.min);
		// available-immediately skills first, gated ones after
		return [...cls.pools]
			.sort((a, b) => order(a) - order(b))
			.map((p) => ({
				...p,
				skills: [...p.skills].sort(
					(a, b) => a.paths.length - b.paths.length,
				),
			}));
	}, [cls]);

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap gap-1.5">
				{sorted.map((c, i) => {
					const fs = factionStyles[c.faction];
					return (
						<button
							key={`${c.faction}-${c.class}`}
							type="button"
							onClick={() => setSelected(i)}
							className={`rounded-md border px-2.5 py-1 text-sm transition-colors ${
								i === selected
									? "border-gold bg-gold/15 font-semibold text-gold"
									: "border-border text-muted-foreground hover:border-gold/50 hover:text-foreground"
							}`}
						>
							<span className={`mr-1.5 rounded px-1 py-px text-[10px] font-semibold ${fs.badge}`}>
								{factions.find((f) => f.name === c.faction)?.shortName}
							</span>
							{c.class}
						</button>
					);
				})}
			</div>

			<div className="rounded-lg border border-border bg-card p-4 shadow-soft">
				<p className="mb-4 text-sm text-muted-foreground">
					<span className={`font-display font-bold ${factionStyles[cls.faction].text}`}>
						{cls.class}
					</span>{" "}
					wielders — {cls.wielders.join(", ")} — draw their level-up offers from
					these pools. Ungated skills can be offered right away; those marked 🔒
					only enter the pool once their prerequisites are learned (hover to see
					which).
				</p>
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
					{pools.map((p) => (
						<div key={p.name}>
							<h3 className="mb-2 font-display text-xs font-bold uppercase tracking-wider text-gold">
								{poolLabel(p)}
							</h3>
							<div className="space-y-1.5">
								{p.skills.map((s) => (
									<SkillEntry key={`${p.name}-${s.name}`} s={s} patches={skillPatches[s.name]} />
								))}
							</div>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
