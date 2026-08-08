import skillDataRaw from "../data/skillDescriptions.json";
import { Tip } from "./Tip";

const skillData = skillDataRaw as {
	skills: Record<string, string[]>;
	powers: Record<string, string[]>;
	icons: Record<string, string>;
};

/** Render a comma-separated skill list as icon chips with level tooltips. */
export function SkillChips({ text }: { text: string }) {
	if (!text) return <>—</>;
	const names = text
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
	return (
		<span className="flex flex-wrap gap-1">
			{names.map((name) => {
				const levels =
					skillData.skills[name] ?? skillData.powers[name] ?? null;
				const icon = skillData.icons[name];
				const chip = (
					<span className="inline-flex cursor-help items-center gap-1.5 rounded border border-border bg-secondary px-1.5 py-0.5 whitespace-nowrap">
						{icon && (
							<img
								src={`/images/skills/${icon}`}
								alt=""
								className="h-5 w-5 rounded-sm"
								loading="lazy"
							/>
						)}
						{name}
					</span>
				);
				if (!levels) return <span key={name}>{chip}</span>;
				return (
					<Tip key={name} label={chip}>
						<span className="font-display font-bold text-gold">{name}</span>
						{levels.map((effect, i) => (
							<span key={`${name}-l${i + 1}`} className="mt-1 block">
								<span className="font-semibold text-foreground/80">
									Level {i + 1}:
								</span>{" "}
								{effect}
							</span>
						))}
					</Tip>
				);
			})}
		</span>
	);
}
