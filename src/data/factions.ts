export interface FactionMeta {
	slug: string;
	name: string;
	shortName: string;
	color: string;
	tagline: string;
	magicOrder: string[];
	magicNotes: string;
	wikiUrl: string;
}

export const factions: FactionMeta[] = [
	{
		slug: "arleon",
		name: "Arleon",
		shortName: "Arleon",
		color: "arleon",
		tagline:
			"The remnants of an empire, broken into warring baronies — knights in an uneasy accord with the Faey of the deep woods.",
		magicOrder: ["Order", "Chaos", "Creation"],
		magicNotes:
			"Quick access to Order and Chaos essence via Shields of Order and Faey Ragers — the easiest route to Rally and Chain Lightning, and currently the only faction that can reliably build for Chain Lightning. Troubadours and the Faey Queen add solid Creation generation for Acid Cloud.",
		wikiUrl: "https://songsofconquest.fandom.com/wiki/Arleon",
	},
	{
		slug: "rana",
		name: "Rana",
		shortName: "Rana",
		color: "rana",
		tagline:
			"The oppressed swamp frog people rising up to reclaim their mighty heritage.",
		magicOrder: ["Creation", "Destruction", "Arcana"],
		magicNotes:
			"In the running for the most powerful spellcasting faction next to Loth. Riders of the Swamp and Chelun Elders can be improved to triple single-essence output, enabling heavy Destruction builds (easiest Fireball access in the game) or Creation/Arcana control with Acid Cloud, Entangle and Dimensional Door.",
		wikiUrl: "https://songsofconquest.fandom.com/wiki/Rana",
	},
	{
		slug: "barya",
		name: "Barya",
		shortName: "Barya",
		color: "barya",
		tagline:
			"Independent merchant states where contracts are law — tinkerers' art and the sound of the Hellbreath keep them ahead of their enemies.",
		magicOrder: ["Order", "Destruction", "Chaos"],
		magicNotes:
			"Excellent Order access with immediate generation from Musketeers and Pikeneers; Destruction is second via Steam Pipers, Tinkerers and Hellroars. Rally is the signature spell, with Fury, Burst of Strength, Justice and arguably the easiest Rapid Fire access in the game.",
		wikiUrl: "https://songsofconquest.fandom.com/wiki/Barya",
	},
	{
		slug: "barony-of-loth",
		name: "Barony of Loth",
		shortName: "Loth",
		color: "loth",
		tagline:
			"An unholy coalition between the dead and the living, bringing death and a glorious afterlife to all who oppose them.",
		magicOrder: ["Arcana", "Destruction", "Order"],
		magicNotes:
			"Necromancers' Charge Essence gives Arcana the edge, making Arcane Storm the most accessible high-tier spell. Nearly every troop produces Destruction essence, so Fireball is close behind — and a minor Order trickle opens Rupture, Justice and Aegis in longer fights.",
		wikiUrl: "https://songsofconquest.fandom.com/wiki/Barony_of_Loth",
	},
	{
		slug: "vanir",
		name: "Vanir",
		shortName: "Vanir",
		color: "vanir",
		tagline:
			"A hardy folk of the Bleak East who raid their former masters, allied with the temperamental Vildra against the terror of the Roots.",
		magicOrder: ["Destruction", "Arcana", "Chaos"],
		magicNotes:
			"Human warriors produce Destruction while Vildra produce Arcana and Chaos — upgrading a unit can completely change its essence output (Huskarl → Korphan). Upgraded Crones are the essence engine. The result is pure offense: damage spells mixed with teleportation to disrupt fragile backlines.",
		wikiUrl: "https://songsofconquest.fandom.com/wiki/Vanir",
	},
	{
		slug: "roots",
		name: "Roots",
		shortName: "Roots",
		color: "roots",
		tagline:
			"A sentient colony of flora, fungus and repurposed bones — neither good nor evil, they simply are.",
		magicOrder: ["Order", "Chaos", "Destruction", "Creation", "Arcana"],
		magicNotes:
			"Unlike every other faction, the Roots are not limited to three essence types — they draw from the full spectrum of magic. As a hive mind, their units generate essence as part of a greater whole, which makes placement and bundling of stacks matter more than for any other faction.",
		wikiUrl: "https://songsofconquest.fandom.com/wiki/Roots",
	},
	{
		slug: "yulan",
		name: "Yulan",
		shortName: "Yulan",
		color: "yulan",
		tagline:
			"A place of wonder and beauty where magical beasts roam — and the houses of Li, Sheng and Xuan vie for the Mandate.",
		magicOrder: ["Order", "Creation", "Arcana"],
		magicNotes:
			"Yulan troops upgrade into house variants, each with its own essence focus: Li stands for Order, Sheng follows Creation, and Xuan focuses on Arcana. Your essence economy is whichever house you commit to — focus one essence or diversify as you conquer more settlements.",
		wikiUrl: "https://songsofconquest.fandom.com/wiki/Yulan",
	},
];

export const factionBySlug = (slug: string) =>
	factions.find((f) => f.slug === slug);

export const factionByName = (name: string) =>
	factions.find((f) => f.name === name);
