import { Tip } from "./Tip";

export interface PatchNote {
	label: string;
	text: string;
}

/** "3 patches" chip that opens the actual changelog lines on hover. */
export function PatchChip({
	patches,
	className = "",
}: {
	patches?: PatchNote[];
	className?: string;
}) {
	if (!patches?.length) return null;
	return (
		<Tip
			className={className}
			label={
				<span className="inline-flex cursor-help items-center gap-1 rounded border border-border bg-secondary px-1.5 py-0.5 text-[10px] whitespace-nowrap text-muted-foreground transition-colors hover:border-gold/60">
					{patches.length} patch{patches.length === 1 ? "" : "es"}
				</span>
			}
		>
			{patches.map((p) => (
				<span key={`${p.label}-${p.text}`} className="mt-1 block first:mt-0">
					<span className="font-semibold text-gold/80">{p.label}</span>{" "}
					<span className="text-muted-foreground">{p.text}</span>
				</span>
			))}
		</Tip>
	);
}
