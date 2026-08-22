import { useMemo, useState } from "react";
import { factions } from "../data/factions";
import { factionStyles } from "../data/factionStyles";
import wieldersRaw from "../data/wielders.json";
import { PatchChip, type PatchNote } from "./PatchChip";
import { SkillChips } from "./SkillChips";

interface Wielder {
	faction: string;
	name: string;
	class: string;
	off: string;
	def: string;
	move: string;
	view: string;
	command: string;
	skills: string;
	specialization: string;
	startingTroops: string;
	image: string | null;
}

const wielders = wieldersRaw as Wielder[];

const shortName = (faction: string) =>
	factions.find((f) => f.name === faction)?.shortName ?? faction;

type SortKey = "name" | "off" | "def" | "move" | "view" | "command";

const num = (s: string) => {
	const m = s.match(/\d+/);
	return m ? Number(m[0]) : 0;
};

const COLUMNS: { key: SortKey; label: string; title: string }[] = [
	{ key: "off", label: "Off", title: "Offence" },
	{ key: "def", label: "Def", title: "Defence" },
	{ key: "move", label: "Move", title: "Movement" },
	{ key: "view", label: "View", title: "View radius" },
	{ key: "command", label: "Cmd", title: "Command (troop slots)" },
];

export default function WielderBrowser({
	patches = {},
	skillPatches = {},
}: {
	patches?: Record<string, PatchNote[]>;
	skillPatches?: Record<string, PatchNote[]>;
}) {
	const [factionFilter, setFactionFilter] = useState<string>("all");
	const [sortKey, setSortKey] = useState<SortKey | null>(null);
	const [sortDir, setSortDir] = useState<1 | -1>(-1);

	const visible = useMemo(() => {
		let out = wielders.filter(
			(w) => factionFilter === "all" || w.faction === factionFilter,
		);
		if (sortKey) {
			out = [...out].sort((a, b) => {
				if (sortKey === "name")
					return a.name.localeCompare(b.name) * sortDir;
				return (num(a[sortKey]) - num(b[sortKey])) * sortDir;
			});
		}
		return out;
	}, [factionFilter, sortKey, sortDir]);

	const toggleSort = (key: SortKey) => {
		if (sortKey === key) {
			setSortDir((d) => (d === 1 ? -1 : 1));
		} else {
			setSortKey(key);
			setSortDir(key === "name" ? 1 : -1);
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
			<div className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-card p-1 w-fit">
				{[["all", "All"], ...factions.map((f) => [f.name, f.shortName])].map(
					([val, label]) => (
						<button
							key={val}
							type="button"
							className={seg(factionFilter === val)}
							onClick={() => setFactionFilter(val)}
						>
							{label}
						</button>
					),
				)}
			</div>

			<div className="overflow-x-auto rounded-lg border border-border shadow-soft">
				<table className="w-full min-w-[1000px] border-collapse text-sm">
					<thead>
						<tr className="bg-secondary text-left">
							<th className="sticky left-0 bg-secondary px-2 py-2.5 font-display text-xs uppercase tracking-wider">
								<button
									type="button"
									className="hover:text-gold"
									onClick={() => toggleSort("name")}
								>
									Wielder
									{sortKey === "name" ? (sortDir === 1 ? " ▲" : " ▼") : ""}
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
								Skills
							</th>
							<th className="px-2 py-2.5 font-display text-xs uppercase tracking-wider">
								Specialization
							</th>
							<th className="px-2 py-2.5 font-display text-xs uppercase tracking-wider">
								Starting Troops
							</th>
						</tr>
					</thead>
					<tbody>
						{visible.map((w) => {
							const fs = factionStyles[w.faction];
							return (
								<tr
									key={`${w.faction}-${w.name}`}
									className={`border-t border-border/60 border-l-2 ${fs.edge} odd:bg-card/40 hover:bg-accent/60 transition-colors`}
								>
									<td className="sticky left-0 bg-background/95 px-2 py-2">
										<div className="flex items-center gap-2.5">
											{w.image ? (
												<img
													src={`/images/wielders/${w.image}`}
													alt={w.name}
													className="h-11 w-11 rounded-full border border-border object-cover bg-secondary"
													loading="lazy"
												/>
											) : (
												<span className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-secondary font-display text-lg text-muted-foreground">
													{w.name[0]}
												</span>
											)}
											<div className="min-w-0">
												<div className="font-semibold whitespace-nowrap">
													{w.name}
												</div>
												<div className="flex items-center gap-1.5 text-xs">
													<PatchChip patches={patches[w.name]} />
													<span
														className={`rounded px-1 py-px text-[10px] font-semibold ${fs.badge}`}
													>
														{shortName(w.faction)}
													</span>
													{w.class && (
														<span className="text-muted-foreground">
															{w.class}
														</span>
													)}
												</div>
											</div>
										</div>
									</td>
									{COLUMNS.map((c) => (
										<td
											key={c.key}
											className="px-2 py-2 whitespace-nowrap tabular-nums"
										>
											{w[c.key] || "—"}
										</td>
									))}
									<td className="px-2 py-2 text-xs text-muted-foreground max-w-56">
										<SkillChips text={w.skills} patches={skillPatches} />
									</td>
									<td className="px-2 py-2 text-xs text-muted-foreground max-w-56">
										{w.specialization || "—"}
									</td>
									<td className="px-2 py-2 text-xs text-muted-foreground max-w-52">
										{w.startingTroops || "—"}
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
