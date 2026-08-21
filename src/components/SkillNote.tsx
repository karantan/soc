/** Editorial note under a skill's level list — when the skill is actually worth a pick. */
export function SkillNote({ note }: { note: string }) {
	return (
		<span className="mt-2 block whitespace-pre-line border-t border-border/60 pt-1.5 text-muted-foreground">
			{note}
		</span>
	);
}
