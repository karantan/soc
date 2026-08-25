/**
 * Faction strategies, written by players and checked against the site's data
 * before they go up. Submitted through the "Strategy" issue template on GitHub;
 * see .github/ISSUE_TEMPLATE/strategy.yml.
 *
 * The house rule: every number in a strategy has to be verifiable from what the
 * Codex already carries — essence per stack from units.json, spell costs from
 * spells.json, skills from skillDescriptions.json. Where a submission's figure
 * didn't survive that check, the correction is stated in the open rather than
 * quietly patched, because a strategy people can't audit is just an opinion.
 */

export interface StrategySection {
	heading: string;
	/** Paragraphs. A line starting with "- " renders as a bullet. */
	body: string[];
}

export interface Strategy {
	slug: string;
	faction: string;
	title: string;
	/** One or two sentences for the index card. */
	summary: string;
	/** Who submitted it, as they want to be credited. */
	author: string;
	/** GitHub issue this came from, if any. */
	issue?: number;
	/** Which magic schools the plan runs on. */
	schools: string[];
	wielders: { name: string; role: string }[];
	sections: StrategySection[];
	/** Checked against the Codex while editing — shown as a footnote. */
	verified?: string[];
}

export const strategies: Strategy[] = [
	{
		slug: "arleon-chaos-chain-lightning",
		faction: "Arleon",
		title: "Faey Chaos: Chain Lightning all the way",
		summary:
			"Arleon's Faey line is a chaos battery. Run Giandra or Ethylle, buy nothing but Faey, and let Chain Lightning do the killing — then bolt on Faey Nobles for creation control once the chaos flows.",
		author: "karantan",
		schools: ["chaos", "creation"],
		wielders: [
			{
				name: "Giandra",
				role: "The consistent one — 8 chaos a turn from the very first round",
			},
			{
				name: "Ethylle",
				role: "The damage one — +70% Spell Damage Power at the cost of a slow start",
			},
		],
		sections: [
			{
				heading: "The idea",
				body: [
					"Arleon reads as a knights-and-order faction, and its human line is exactly that. The Faey line is a different game entirely: it is the densest chaos essence in the roster, and chaos ends in Chain Lightning — 100 damage at tier 3, jumping to two more troops for full damage each time. That is 300 damage spread across three stacks for one cast, before any spell power at all.",
					"So the plan is not to build an Arleon army that happens to cast. It is to treat every Faey stack as a generator, keep your troop slots full of them, and win fights with the wielder while the bodies just have to survive.",
				],
			},
			{
				heading: "Pick your wielder — and know what you traded",
				body: [
					"Both starts are Faey, and both are Erudites, but they are not the same plan.",
					"- **Giandra** opens with two stacks of Faey Spirits and one Horned One. Faey Spirits generate 2 chaos each and the Horned One 1, so the troops alone are **5 chaos a turn**. She then adds **+3 more** on her own — Chaos Magic starts at +2 Chaos Essence and her specialization is another +1 — for **8 chaos a turn from round one**.",
					"- **Ethylle** opens with a Faey Noble and one stack of Faey Spirits: **3 chaos and 1 creation**. Her skill and specialization spend themselves on damage instead — Channeling at +30% and her specialization at +40%, and because both grant the same stat they add, so she casts at **+70% Spell Damage Power immediately**.",
					"Chain Lightning costs **12 chaos**. Giandra casts it every turn and a half. Ethylle casts it once every four turns until she picks up Chaos Magic, which is why she is the sharper but shakier pick: her damage is enormous and her cadence is bad, and if the Chaos Magic offer is slow to arrive she spends the early game as a worse Giandra.",
					"Read it as consistency versus ceiling. Giandra's tier-3 Chain Lightning hits for 100 a jump. Ethylle's hits for 170 on the same tier, and 240 once Channeling is maxed — 720 damage across three stacks in a single cast — but only if she got there.",
				],
			},
			{
				heading: "The build",
				body: [
					"Buy Faey. That is most of it.",
					"- **Faey Spirits** are the engine: 2 chaos a stack, 250 gold, and the Faey Grove makes 3 a round. They are cheap enough that filling slots with them is never wrong.",
					"- **Horned Ones** add 1 chaos each and hit far harder than a Spirit. They need the Sounds of Battle improvement on the Faey Grove, which produces 1 a round.",
					"- Skip the human line. Militia, Footmen and Knights are order-and-gold units; every slot they take is chaos you are not generating.",
					"Take Chaos Magic to 3 as it is offered. Level 2 unlocks tier-2 chaos spells and level 3 unlocks tier 3, so the skill is not just essence income — it is the gate on Chain Lightning's damage tier. On Ethylle it is the first priority, full stop.",
				],
			},
			{
				heading: "Adding creation: the Faey Noble turn",
				body: [
					"Once chaos is comfortably ahead of what you can spend, the Faey Court is the upgrade that changes the shape of your army. Faey Nobles generate 1 creation and 1 chaos; Faey Queens generate 2 creation and 1 chaos.",
					"Creation is where Arleon's control lives, and all three of the good ones are cheap next to Chain Lightning: **Insect Swarm** at 4, **Mist** at 7, **Acid Cloud** at 12. Swarm and Cloud both tick again on the target's following turn, so a fight you have slowed with Mist is a fight where the damage-over-time gets a second round to land.",
					"The combination is the actual win condition. Chain Lightning deletes a clumped stack, Acid Cloud punishes anything that walks through the gap, and Mist decides where the enemy is allowed to be. Nothing in that plan asks your troops to win a melee.",
				],
			},
			{
				heading: "Where it falls apart",
				body: [
					"- **Order Magic on the other side.** Judgment does not care how much essence you have banked, and Faey stacks are small.",
					"- **Slow skill offers on Ethylle.** No Chaos Magic means no tier-3 chaos, and +70% of a tier-1 spell is not a plan.",
					"- **Faey are fragile bodies.** The Codex's own scoring rates the whole Faey line below its role's efficiency median — you are not buying them to fight, you are buying them to generate, and if a fight comes down to the bodies you lose it.",
					"- **Glimmerweave.** Faey Nobles and Queens both want it on top of gold, so the creation half of the plan is gated on a rare resource, not just on income.",
				],
			},
		],
		verified: [
			"Giandra's opening troops — 2 Faey Spirit stacks (2 chaos each) + 1 Horned One (1) = 5 chaos a turn",
			"Giandra's +3: Chaos Magic level 1 grants +2 Chaos Essence, her specialization +1",
			"Ethylle's opening troops = 3 chaos + 1 creation, not 5 chaos; her edge is +70% Spell Damage Power (Channeling 30% + specialization 40%, which add)",
			"Chain Lightning costs 12 chaos and deals 35/70/100 per jump, twice more per cast",
			"Insect Swarm 4, Mist 7, Acid Cloud 12 — all creation",
		],
	},
];

export const strategiesByFaction = (faction: string) =>
	strategies.filter((s) => s.faction === faction);
