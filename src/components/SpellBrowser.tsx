import { useMemo, useState } from "react";
import { factions } from "../data/factions";
import spellsRaw from "../data/spells.json";

interface Spell {
	name: string;
	type: "pure" | "dyad";
	schools: string[];
	essences: Record<string, number>;
	totalCost: number;
	duration: string;
	tiers: string[];
	image: string;
}

const spells = spellsRaw as Spell[];

const SCHOOLS = ["order", "chaos", "destruction", "creation", "arcana"] as const;

const SCHOOL_LABEL: Record<string, string> = {
	order: "Order",
	chaos: "Chaos",
	destruction: "Destruction",
	creation: "Creation",
	arcana: "Arcana",
};

const SCHOOL_TEXT: Record<string, string> = {
	order: "text-school-order",
	chaos: "text-school-chaos",
	destruction: "text-school-destruction",
	creation: "text-school-creation",
	arcana: "text-school-arcana",
};

const SCHOOL_BORDER: Record<string, string> = {
	order: "border-t-school-order",
	chaos: "border-t-school-chaos",
	destruction: "border-t-school-destruction",
	creation: "border-t-school-creation",
	arcana: "border-t-school-arcana",
};

// Faction magic affinities (essence types their own troops produce)
const FACTION_AFFINITY: Record<string, string[]> = Object.fromEntries(
	factions.map((f) => [f.shortName, f.magicOrder.map((s) => s.toLowerCase())]),
);

export default function SpellBrowser() {
	const [schoolFilter, setSchoolFilter] = useState<string>("all");
	const [factionFilter, setFactionFilter] = useState<string>("all");
	const [tier, setTier] = useState<0 | 1 | 2>(0);

	const visible = useMemo(() => {
		return spells.filter((s) => {
			if (schoolFilter === "dyad" && s.type !== "dyad") return false;
			if (
				schoolFilter !== "all" &&
				schoolFilter !== "dyad" &&
				!s.schools.includes(schoolFilter)
			)
				return false;
			if (factionFilter !== "all") {
				const aff = FACTION_AFFINITY[factionFilter];
				if (!s.schools.every((sc) => aff.includes(sc))) return false;
			}
			return true;
		});
	}, [schoolFilter, factionFilter]);

	const seg = (active: boolean) =>
		`px-3 py-1.5 text-sm rounded-md transition-colors ${
			active
				? "bg-primary text-primary-foreground font-semibold"
				: "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
		}`;

	return (
		<div className="space-y-5">
			<div className="flex flex-wrap items-center gap-x-6 gap-y-3">
				<div className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-card p-1">
					<button
						type="button"
						className={seg(schoolFilter === "all")}
						onClick={() => setSchoolFilter("all")}
					>
						All
					</button>
					{SCHOOLS.map((s) => (
						<button
							key={s}
							type="button"
							className={seg(schoolFilter === s)}
							onClick={() => setSchoolFilter(s)}
						>
							<span className="inline-flex items-center gap-1.5">
								<img
									src={`/images/units/icon-${s}.jpg`}
									alt=""
									className="h-3.5 w-3.5 rounded-[2px]"
								/>
								{SCHOOL_LABEL[s]}
							</span>
						</button>
					))}
					<button
						type="button"
						className={seg(schoolFilter === "dyad")}
						onClick={() => setSchoolFilter("dyad")}
					>
						Dyads
					</button>
				</div>

				<div className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-card p-1">
					{["all", ...factions.map((f) => f.shortName)].map((f) => (
						<button
							key={f}
							type="button"
							className={seg(factionFilter === f)}
							onClick={() => setFactionFilter(f)}
							title={
								f === "all"
									? "All spells"
									: `Spells whose essences ${f}'s own troops produce`
							}
						>
							{f === "all" ? "Any faction" : f}
						</button>
					))}
				</div>

				<div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
					{([0, 1, 2] as const).map((t) => (
						<button
							key={t}
							type="button"
							className={seg(tier === t)}
							onClick={() => setTier(t)}
						>
							Tier {t + 1}
						</button>
					))}
				</div>
			</div>

			<p className="text-xs text-muted-foreground">
				{visible.length} spells. Faction affinity = every essence the spell
				needs is produced by that faction&apos;s own troops (wielders can still
				learn others via research and points of interest).
			</p>

			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{visible.map((s) => (
					<article
						key={s.name}
						className={`rounded-lg border border-border border-t-2 ${SCHOOL_BORDER[s.schools[0]]} bg-card p-4 shadow-soft flex flex-col`}
					>
						<header className="flex items-start justify-between gap-2">
							<span className="flex items-center gap-2.5 min-w-0">
								<img
									src={`/images/spells/${s.image}`}
									alt=""
									className="h-11 w-11 shrink-0 rounded-full border border-border shadow-soft"
									loading="lazy"
								/>
								<h3 className="font-display font-bold leading-tight">
									{s.name}
								</h3>
							</span>
							<span className="flex flex-col items-end gap-0.5 whitespace-nowrap text-sm">
								{Object.entries(s.essences).map(([sc, n]) => (
									<span
										key={sc}
										className={`inline-flex items-center gap-1 font-semibold tabular-nums ${SCHOOL_TEXT[sc]}`}
									>
										{n}
										<img
											src={`/images/units/icon-${sc}.jpg`}
											alt={sc}
											title={`${SCHOOL_LABEL[sc]} essence`}
											className="h-3.5 w-3.5 rounded-[2px]"
										/>
									</span>
								))}
							</span>
						</header>
						<p className="mt-1 text-xs">
							{s.schools.map((sc, i) => (
								<span key={sc}>
									{i > 0 && <span className="text-muted-foreground"> + </span>}
									<span className={`font-semibold ${SCHOOL_TEXT[sc]}`}>
										{SCHOOL_LABEL[sc]}
									</span>
								</span>
							))}
							{s.type === "dyad" && (
								<span className="ml-1.5 rounded bg-secondary px-1 py-px text-[10px] uppercase tracking-wider text-muted-foreground">
									dyad
								</span>
							)}
							{s.duration && (
								<span className="ml-2 text-muted-foreground">
									Duration: {s.duration}
								</span>
							)}
						</p>
						<p className="mt-3 whitespace-pre-line text-sm text-foreground/90">
							{s.tiers[tier]}
						</p>
					</article>
				))}
			</div>
		</div>
	);
}
