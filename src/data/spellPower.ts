import wieldersRaw from "./wielders.json";

/**
 * Spell Damage Power — what raises the numbers a damaging spell prints.
 *
 * Two sources exist in the game, and both grant the same stat, so they add
 * before applying: a wielder with Channeling and a +40% specialization casts
 * at +70% / +100% / +140% for Channeling 1 / 2 / 3.
 *
 * Resistance is the other half of the story and belongs to the target, not the
 * spell, so it lives in the damage calculator rather than here.
 */

/** Channeling skill, by level taken (index 0 = not taken). */
export const CHANNELING = [0, 30, 60, 100];

/** Every wielder whose specialization grants Spell Damage Power. */
export const SPELL_POWER_WIELDERS = (
	wieldersRaw as { name: string; faction: string; specialization: string }[]
)
	.map((w) => {
		const m = /([+-]?\d+)%\s*Spell Damage Power/i.exec(w.specialization ?? "");
		return m ? { name: w.name, faction: w.faction, pct: Number(m[1]) } : null;
	})
	.filter((w): w is { name: string; faction: string; pct: number } => w !== null);

/** They all grant the same amount today; read it rather than hard-code 40. */
export const SPECIALIZATION_PCT = SPELL_POWER_WIELDERS[0]?.pct ?? 0;

/** Multiplier applied to a spell's printed damage. */
export const spellPowerMultiplier = (channeling: number, specialized: boolean) =>
	1 + (CHANNELING[channeling] + (specialized ? SPECIALIZATION_PCT : 0)) / 100;

/**
 * A spell's effect text, split so damage numbers can be re-rendered.
 *
 * Only bare "<n> damage" counts. A signed number is a troop buff or debuff
 * rather than the spell's own output — Burst of Strength's "+1 Damage" is
 * damage the troop deals, and Pacify's "-25% Damage" is a percentage — so
 * neither scales with Spell Damage Power.
 */
const DAMAGE = /(?<![+-])\b(\d+)(\s+damage\b)/gi;

/** `at` is the segment's offset in the source text — a stable render key. */
export type Segment =
	| { at: number; text: string }
	| { at: number; base: number; boosted: number; suffix: string };

export const splitDamage = (text: string, multiplier: number): Segment[] => {
	const out: Segment[] = [];
	let last = 0;
	DAMAGE.lastIndex = 0;
	let m = DAMAGE.exec(text);
	while (m !== null) {
		if (m.index > last) out.push({ at: last, text: text.slice(last, m.index) });
		const base = Number(m[1]);
		out.push({
			at: m.index,
			base,
			boosted: Math.round(base * multiplier),
			suffix: m[2],
		});
		last = m.index + m[0].length;
		m = DAMAGE.exec(text);
	}
	if (last < text.length) out.push({ at: last, text: text.slice(last) });
	return out;
};

/** Does this spell print any damage at all? */
export const dealsDamage = (tiers: string[]) =>
	tiers.some((t) => splitDamage(t, 1).some((s) => "base" in s));
