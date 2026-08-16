import type { ResearchUnit } from "../data/researchUnits";
import researchRaw from "../data/research.json";
import { Tip } from "./Tip";

interface ResearchLevel {
	cost: Record<string, number>;
	effect: string;
}

interface ResearchStack {
	key: string;
	name: string;
	category: string;
	levels: ResearchLevel[];
}

interface ResearchBuilding {
	faction: string;
	building: string;
	description: string;
	stacks: ResearchStack[];
}

const research = researchRaw as ResearchBuilding[];

const RESOURCE_ICONS: Record<string, string> = {
	gold: "/images/units/icon-gold.jpg",
	amber: "/images/units/icon-amber.jpg",
	celestial: "/images/units/icon-celestial.jpg",
	glimmer: "/images/units/icon-glimmer.jpg",
};

export function CostInline({ cost }: { cost: Record<string, number> }) {
	const entries = Object.entries(cost);
	if (!entries.length) return null;
	return (
		<span className="inline-flex items-center gap-1.5">
			{entries.map(([res, n]) => (
				<span key={res} className="inline-flex items-center gap-0.5 whitespace-nowrap">
					{n}
					{RESOURCE_ICONS[res] ? (
						<img
							src={RESOURCE_ICONS[res]}
							alt={res}
							title={res}
							className="h-3 w-3 rounded-[2px]"
						/>
					) : (
						<span>{res}</span>
					)}
				</span>
			))}
		</span>
	);
}

export function ResearchLevels({ levels }: { levels: ResearchLevel[] }) {
	return (
		<>
			{levels.map((lv, i) => (
				<span key={`l${i + 1}`} className="mt-1 flex items-baseline gap-2">
					<span className="shrink-0 font-semibold text-foreground/80">
						{levels.length > 1 ? `Level ${i + 1}:` : ""}
					</span>
					<span>
						{lv.effect}
						<span className="ml-1.5 text-muted-foreground">
							(<CostInline cost={lv.cost} />)
						</span>
					</span>
				</span>
			))}
		</>
	);
}

const CATEGORY_LABEL: Record<string, string> = {
	Troops: "Troop Improvements",
	human: "Human",
};

// Generic stat researches (category is the modifier itself) collapse into one group
const normalizeCategory = (cat: string) =>
	/^Troop(Melee|Ranged)?(Offense|Defense|HP|Health|Initiative|Damage|Buff|Init)?$/i.test(
		cat,
	)
		? "General Troop Bonuses"
		: (CATEGORY_LABEL[cat] ?? cat ?? "Other");

/** Portrait of the unit a research applies to, or its initial when no art exists. */
function UnitMark({ unit }: { unit: ResearchUnit }) {
	if (unit.image) {
		return (
			<img
				src={`/images/units/${unit.image}`}
				alt=""
				className="-ml-0.5 h-5 w-5 shrink-0 rounded-[3px] border border-border/70 object-cover"
				loading="lazy"
			/>
		);
	}
	return (
		<span className="-ml-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[3px] border border-border/70 bg-muted font-display text-[10px] font-bold text-muted-foreground">
			{unit.name[0]}
		</span>
	);
}

export default function ResearchPanel({
	faction,
	units = {},
}: {
	faction: string;
	units?: Record<string, ResearchUnit>;
}) {
	const buildings = research.filter((r) => r.faction === faction);
	return (
		<div className="grid gap-5 lg:grid-cols-2">
			{buildings.map((b) => {
				const categories: Record<string, ResearchStack[]> = {};
				for (const s of b.stacks) {
					const c = normalizeCategory(s.category);
					(categories[c] ??= []).push(s);
				}
				return (
					<div key={b.building} className="rounded-lg border border-border bg-card p-5 shadow-soft">
						<h3 className="font-display text-lg font-bold text-gold">
							{b.building}
						</h3>
						{b.description && (
							<p className="mt-1 text-xs italic text-muted-foreground">
								{b.description}
							</p>
						)}
						<div className="mt-4 space-y-4">
							{Object.entries(categories).map(([cat, stacks]) => (
								<div key={cat}>
									<h4 className="mb-1.5 font-display text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
										{cat.replace(/(?<=[a-z])(?=[A-Z])/g, " ")}
									</h4>
									<div className="flex flex-wrap gap-1.5">
										{stacks.map((s) => {
											const unit = units[s.key];
											return (
												<Tip
													key={s.key}
													label={
														<span
															className={`inline-flex cursor-help items-center gap-1.5 rounded border border-border bg-secondary py-1 text-sm transition-colors hover:border-gold/60 ${
																unit ? "pr-2 pl-1.5" : "px-2"
															}`}
														>
															{unit && <UnitMark unit={unit} />}
															{s.name}
															{s.levels.length > 1 && (
																<span className="text-[10px] text-muted-foreground">
																	×{s.levels.length}
																</span>
															)}
														</span>
													}
												>
													<span className="font-display font-bold text-gold">
														{s.name}
													</span>
													{unit && (
														<span className="mt-0.5 flex items-center gap-1.5 text-muted-foreground">
															<UnitMark unit={unit} />
															{unit.name}
														</span>
													)}
													<ResearchLevels levels={s.levels} />
												</Tip>
											);
										})}
									</div>
								</div>
							))}
						</div>
					</div>
				);
			})}
		</div>
	);
}
