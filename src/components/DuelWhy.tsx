import {
	essenceBonus,
	essenceValue,
	FACTOR_ROWS,
	type Factors,
	factorValue,
	magicFor,
	type PowerEntry,
	type Rating,
	type School,
	SCHOOL_LABEL,
	SCHOOLS,
} from "../data/unitPower";

/**
 * Why two units' scores differ, decomposed rather than asserted.
 *
 * Magic splits additively (body + essence), so that half is a sum. The body
 * itself is a product of independent factors, so that half is a ladder of
 * ratios: each factor's ratio between the two units is exactly its share of
 * the gap, and they multiply back to the whole. Rows are ordered by how much
 * they actually move the number, so the real driver is always at the top
 * rather than wherever the stat block happens to list it.
 */

const fmt = (n: number, digits = 2) =>
	n.toLocaleString("en-US", { maximumFractionDigits: digits });

const ratio = (x: number, y: number) => (x >= y ? x / y : y / x);

interface Side {
	name: string;
	entry: PowerEntry;
}

function Split({
	side,
	schools,
	field,
}: {
	side: Side;
	schools: readonly School[];
	field: "power" | "eff";
}) {
	const might = side.entry.adj.might as Rating | undefined;
	const total = magicFor(side.entry, schools);
	if (!might || !total) return <span className="text-muted-foreground">—</span>;
	const bonus = essenceBonus(side.entry, schools)[field];
	return (
		<span className="tabular-nums">
			<span className="font-bold text-gold">{total[field]}</span>
			<span className="text-muted-foreground">
				{" "}
				= {might[field]} body + {Math.round(bonus)} essence
			</span>
		</span>
	);
}

function EssenceLine({ side, schools }: { side: Side; schools: readonly School[] }) {
	const carried = SCHOOLS.filter((s) => (side.entry.essence?.[s] ?? 0) > 0);
	if (!carried.length)
		return <span className="text-xs text-muted-foreground">no essence</span>;
	const counted = essenceValue(side.entry, schools);
	return (
		<span className="text-xs">
			{carried.map((s, i) => {
				const inBuild = schools.includes(s);
				return (
					<span key={s} className={inBuild ? "text-foreground" : "text-muted-foreground/60"}>
						{i > 0 && ", "}
						{SCHOOL_LABEL[s]} {fmt(side.entry.essence?.[s] ?? 0, 0)}
						{!inBuild && " (not cast)"}
					</span>
				);
			})}
			<span className="text-muted-foreground"> = {fmt(counted, 0)}</span>
		</span>
	);
}

export default function DuelWhy({
	a,
	b,
	schools,
}: {
	a: Side;
	b: Side;
	schools: readonly School[];
}) {
	if (!a.entry.factors || !b.entry.factors) return null;

	const rows = FACTOR_ROWS.map((row) => {
		const va = factorValue(a.entry, row.key as keyof Factors | "cost");
		const vb = factorValue(b.entry, row.key as keyof Factors | "cost");
		return { ...row, va, vb };
	})
		.filter(
			(r): r is typeof r & { va: number; vb: number } =>
				typeof r.va === "number" && typeof r.vb === "number" && r.va > 0 && r.vb > 0,
		)
		// biggest mover first: a factor that is equal on both units explains nothing
		.sort((x, y) => Math.abs(Math.log(y.va / y.vb)) - Math.abs(Math.log(x.va / x.vb)));

	// Alignment has to come from the caller: two Tailwind text-align utilities on
	// one element resolve by stylesheet order, not by the order written here, so
	// appending "text-left" to a class string that already says "text-right"
	// silently keeps the right. The pair reads as a pair only when the left value
	// is right-aligned and the right value left-aligned, hugging the label.
	const cell = (win: boolean, align: "left" | "right") =>
		`${align === "right" ? "text-right" : "text-left"} tabular-nums text-sm ${
			win ? "font-bold text-gold" : "text-muted-foreground"
		}`;

	return (
		<div className="mt-4 rounded-md border border-border/60 bg-background/40 p-3">
			<h3 className="font-display text-[11px] font-bold uppercase tracking-wider text-gold">
				Why the scores differ
			</h3>

			<dl className="mt-2 divide-y divide-border/40 text-sm">
				{(["power", "eff"] as const).map((field) => (
					<div
						key={field}
						className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-4 py-1.5"
					>
						<span className="text-right">
							<Split side={a} schools={schools} field={field} />
						</span>
						<dt className="w-24 text-center font-display text-[11px] uppercase tracking-wider text-muted-foreground">
							Magic {field === "power" ? "Power" : "Eff"}
						</dt>
						<span className="text-left">
							<Split side={b} schools={schools} field={field} />
						</span>
					</div>
				))}
				<div className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-4 py-1.5">
					<span className="text-right">
						<EssenceLine side={a} schools={schools} />
					</span>
					<dt className="w-24 text-center font-display text-[11px] uppercase tracking-wider text-muted-foreground">
						Essence
					</dt>
					<span className="text-left">
						<EssenceLine side={b} schools={schools} />
					</span>
				</div>
			</dl>

			<p className="mt-3 text-xs text-muted-foreground">
				The essence half is added, so it reads as a sum. The body half is a
				product, so it reads as a ladder: every factor below is stated as it
				enters Power, its ratio between the two units is exactly that stat's
				share of the gap, and the ratios multiply back to the whole. Ordered by
				how much each one actually moves the number.
			</p>

			<dl className="mt-2 divide-y divide-border/40">
				{rows.map((r) => {
					const aWins = r.va > r.vb;
					const gap = ratio(r.va, r.vb);
					return (
						<div
							key={r.key}
							className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-4 py-1"
						>
							<span className={cell(aWins && gap > 1.005, "right")}>{fmt(r.va)}</span>
							<dt
								className="w-32 text-center"
								title={r.blurb}
								data-tip={r.blurb}
								data-tip-title={r.label}
							>
								<span className="block font-display text-[11px] uppercase tracking-wider text-muted-foreground">
									{r.label}
									{r.effOnly && (
										<span className="ml-1 normal-case text-[9px] text-gold/80">
											eff only
										</span>
									)}
								</span>
								<span className="block text-[10px] tabular-nums text-muted-foreground/80">
									{gap < 1.005
										? "level"
										: `${aWins ? a.name : b.name} ${fmt(gap)}x`}
								</span>
							</dt>
							<span className={cell(!aWins && gap > 1.005, "left")}>{fmt(r.vb)}</span>
						</div>
					);
				})}
			</dl>
		</div>
	);
}
