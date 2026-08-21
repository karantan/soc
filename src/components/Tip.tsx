import { type ReactNode, useState } from "react";
import { createPortal } from "react-dom";

/** Hover tooltip rendered with fixed positioning so scroll containers can't clip it. */
export function Tip({
	label,
	children,
	className = "",
}: {
	label: ReactNode;
	children: ReactNode;
	className?: string;
}) {
	const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
	// Measured so a long tooltip (skill notes) still fits above the fold.
	const [height, setHeight] = useState(140);
	return (
		<span
			className={className}
			onMouseEnter={(e) => setPos({ x: e.clientX, y: e.clientY })}
			onMouseMove={(e) => setPos({ x: e.clientX, y: e.clientY })}
			onMouseLeave={() => setPos(null)}
		>
			{label}
			{pos &&
				// Portal to <body>: sticky table columns would otherwise paint over it.
				createPortal(
					<span
						ref={(el) => {
							if (!el) return;
							const h = el.getBoundingClientRect().height;
							if (Math.abs(h - height) > 1) setHeight(h);
						}}
						style={{
							position: "fixed",
							left: Math.min(pos.x + 14, window.innerWidth - 300),
							top: Math.max(
								8,
								Math.min(pos.y + 16, window.innerHeight - height - 8),
							),
							width: 280,
							zIndex: 9999,
							pointerEvents: "none",
						}}
						className="block rounded-md border border-gold/40 bg-popover p-3 text-xs leading-relaxed text-popover-foreground shadow-strong"
					>
						{children}
					</span>,
					document.body,
				)}
		</span>
	);
}

import abilityDescRaw from "../data/abilityDescriptions.json";

const abilityDesc = abilityDescRaw as Record<string, string>;

/** Render a comma/slash separated special/ability string as hoverable tokens. */
export function AbilityTokens({ text }: { text: string }) {
	if (!text) return <>—</>;
	const tokens = text
		.split(/[,/]/)
		.map((s) => s.trim())
		.filter(Boolean);
	return (
		<>
			{tokens.map((tok, i) => {
				const desc = abilityDesc[tok];
				return (
					<span key={tok}>
						{i > 0 && ", "}
						{desc ? (
							<Tip
								label={
									<span className="cursor-help underline decoration-dotted decoration-muted-foreground/60 underline-offset-2">
										{tok}
									</span>
								}
							>
								<span className="font-display font-bold text-gold">{tok}</span>
								<br />
								{desc}
							</Tip>
						) : (
							tok
						)}
					</span>
				);
			})}
		</>
	);
}
