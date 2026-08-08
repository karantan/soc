// Literal Tailwind class strings per faction (JIT needs them spelled out).
// Keyed by faction *name* as it appears in units.json.
export interface FactionStyle {
	text: string;
	badge: string;
	edge: string;
	cardBorder: string;
}

export const factionStyles: Record<string, FactionStyle> = {
	Arleon: {
		text: "text-arleon",
		badge: "bg-arleon-soft text-arleon",
		edge: "border-l-arleon",
		cardBorder: "border-arleon/40 hover:border-arleon",
	},
	Rana: {
		text: "text-rana",
		badge: "bg-rana-soft text-rana",
		edge: "border-l-rana",
		cardBorder: "border-rana/40 hover:border-rana",
	},
	Barya: {
		text: "text-barya",
		badge: "bg-barya-soft text-barya",
		edge: "border-l-barya",
		cardBorder: "border-barya/40 hover:border-barya",
	},
	"Barony of Loth": {
		text: "text-loth",
		badge: "bg-loth-soft text-loth",
		edge: "border-l-loth",
		cardBorder: "border-loth/40 hover:border-loth",
	},
	Vanir: {
		text: "text-vanir",
		badge: "bg-vanir-soft text-vanir",
		edge: "border-l-vanir",
		cardBorder: "border-vanir/40 hover:border-vanir",
	},
	Roots: {
		text: "text-roots",
		badge: "bg-roots-soft text-roots",
		edge: "border-l-roots",
		cardBorder: "border-roots/40 hover:border-roots",
	},
	Yulan: {
		text: "text-yulan",
		badge: "bg-yulan-soft text-yulan",
		edge: "border-l-yulan",
		cardBorder: "border-yulan/40 hover:border-yulan",
	},
};
