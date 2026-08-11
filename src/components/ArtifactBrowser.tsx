import { useMemo, useState } from "react";
import artifactsRaw from "../data/artifacts.json";
import setsRaw from "../data/artifactSets.json";
import { Tip } from "./Tip";

interface Artifact {
	name: string;
	rarity: string;
	slot: string;
	kind: string;
	bonus: string;
	penalty: string;
	set: string;
	lore: string;
	effect: string;
	image: string | null;
}

interface ArtifactSet {
	name: string;
	pieces: string[];
	bonuses: string[];
}

// The wiki table lists a few artifacts twice; de-duplicate so React keys stay unique.
const artifacts = [
	...new Map((artifactsRaw as Artifact[]).map((a) => [a.name, a])).values(),
];
const sets = setsRaw as ArtifactSet[];

// in-game rarity colours
const RARITY: Record<string, { text: string; ring: string; order: number }> = {
	Grey: { text: "text-slate-300", ring: "border-slate-400/40", order: 0 },
	Green: { text: "text-green-400", ring: "border-green-400/40", order: 1 },
	Blue: { text: "text-blue-400", ring: "border-blue-400/40", order: 2 },
	Violet: { text: "text-fuchsia-400", ring: "border-fuchsia-400/40", order: 3 },
	Orange: { text: "text-orange-400", ring: "border-orange-400/40", order: 4 },
};

const SLOTS = [
	"Any Hand",
	"Main Hand",
	"Both Hands",
	"Off Hand",
	"Head",
	"Chest",
	"Hands",
	"Feet",
	"Resource Generation",
	"Exploration",
	"Combat",
	"Essence",
	"Other",
];

const RARITIES = ["Grey", "Green", "Blue", "Violet", "Orange"];

export default function ArtifactBrowser() {
	const [slot, setSlot] = useState("all");
	const [rarity, setRarity] = useState("all");
	const [query, setQuery] = useState("");
	const [setsOnly, setSetsOnly] = useState(false);

	const visible = useMemo(() => {
		const q = query.trim().toLowerCase();
		return artifacts.filter((a) => {
			if (slot !== "all" && a.slot !== slot) return false;
			if (rarity !== "all" && a.rarity !== rarity) return false;
			if (setsOnly && !a.set) return false;
			if (
				q &&
				!(
					a.name.toLowerCase().includes(q) ||
					a.bonus.toLowerCase().includes(q) ||
					a.set.toLowerCase().includes(q)
				)
			)
				return false;
			return true;
		});
	}, [slot, rarity, query, setsOnly]);

	const seg = (active: boolean) =>
		`px-2.5 py-1 text-sm rounded-md transition-colors ${
			active
				? "bg-primary text-primary-foreground font-semibold"
				: "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
		}`;

	const setByName = (n: string) => sets.find((s) => s.name === n);

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-center gap-x-4 gap-y-3">
				<div className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-card p-1">
					<button
						type="button"
						className={seg(slot === "all")}
						onClick={() => setSlot("all")}
					>
						All slots
					</button>
					{SLOTS.map((s) => (
						<button
							key={s}
							type="button"
							className={seg(slot === s)}
							onClick={() => setSlot(s)}
						>
							{s}
						</button>
					))}
				</div>

				<div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
					<button
						type="button"
						className={seg(rarity === "all")}
						onClick={() => setRarity("all")}
					>
						Any rarity
					</button>
					{RARITIES.map((r) => (
						<button
							key={r}
							type="button"
							className={`${seg(rarity === r)} ${rarity === r ? "" : RARITY[r].text}`}
							onClick={() => setRarity(r)}
						>
							{r}
						</button>
					))}
				</div>

				<button
					type="button"
					className={`rounded-lg border border-border bg-card px-3 py-1.5 text-sm transition-colors ${
						setsOnly
							? "border-gold text-gold font-semibold"
							: "text-muted-foreground hover:text-foreground"
					}`}
					onClick={() => setSetsOnly((v) => !v)}
				>
					Set pieces only
				</button>

				<input
					type="search"
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					placeholder="Search name or effect…"
					className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus:border-gold/60"
				/>
			</div>

			<p className="text-xs text-muted-foreground">
				{visible.length} of {artifacts.length} artifacts. Hover one for its lore
				and exact modifiers; set pieces show the full set bonus.
			</p>

			<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
				{visible.map((a) => {
					const r = RARITY[a.rarity];
					const s = a.set ? setByName(a.set) : undefined;
					return (
						<Tip
							key={a.name}
							className="block"
							label={
								<span
									className={`flex h-full cursor-help items-start gap-3 rounded-lg border bg-card p-3 shadow-soft transition-colors hover:border-gold/60 ${
										r?.ring ?? "border-border"
									}`}
								>
									{a.image && (
										<img
											src={`/images/artifacts/${a.image}`}
											alt=""
											className="h-11 w-11 shrink-0 object-contain"
											loading="lazy"
										/>
									)}
									<span className="min-w-0">
										<span
											className={`block font-display font-bold leading-tight ${r?.text ?? "text-foreground"}`}
										>
											{a.name}
										</span>
										<span className="mt-0.5 block text-xs text-foreground/90">
											{a.bonus || a.effect || "—"}
										</span>
										{a.penalty && (
											<span className="mt-0.5 block text-xs text-destructive-foreground/80">
												{a.penalty}
											</span>
										)}
										<span className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
											<span>{a.slot}</span>
											{a.set && (
												<span className="rounded bg-gold/15 px-1 py-px text-gold">
													{a.set}
												</span>
											)}
										</span>
									</span>
								</span>
							}
						>
							<span
								className={`font-display font-bold ${r?.text ?? "text-gold"}`}
							>
								{a.name}
							</span>
							<span className="mt-0.5 block text-muted-foreground">
								{[a.rarity, a.slot].filter(Boolean).join(" · ")}
							</span>
							{a.effect && (
								<span className="mt-1.5 block">
									<span className="font-semibold text-foreground/80">
										Effect:
									</span>{" "}
									{a.effect}
								</span>
							)}
							{a.penalty && (
								<span className="mt-1 block">
									<span className="font-semibold text-foreground/80">
										Penalty:
									</span>{" "}
									{a.penalty}
								</span>
							)}
							{s && (
								<span className="mt-1.5 block">
									<span className="font-semibold text-gold">{s.name}</span>
									<span className="block text-muted-foreground">
										{s.pieces.join(", ")}
									</span>
									{s.bonuses.map((b) => (
										<span key={b} className="block">
											{b}
										</span>
									))}
								</span>
							)}
							{a.lore && (
								<span className="mt-1.5 block italic text-muted-foreground">
									{a.lore}
								</span>
							)}
						</Tip>
					);
				})}
			</div>
		</div>
	);
}
