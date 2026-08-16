import unitResearchRaw from "./unitResearch.json";
import unitsRaw from "./units.json";

export interface ResearchUnit {
	name: string;
	image?: string;
}

interface UnitResearchEntry {
	building: string;
	name: string;
}

const unitResearch = unitResearchRaw as Record<string, UnitResearchEntry[]>;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

const unitByName = new Map<string, ResearchUnit>();
for (const u of unitsRaw) {
	unitByName.set(`${u.faction}|${u.base.name}`, {
		name: u.base.name,
		image: u.base.image,
	});
}

// faction|building|research name -> unit, from the per-unit research listing
const byResearchName = new Map<string, ResearchUnit>();
for (const [uid, entries] of Object.entries(unitResearch)) {
	const [faction, unitName] = uid.split("|");
	const unit = unitByName.get(uid) ?? { name: unitName };
	for (const e of entries) {
		byResearchName.set(`${faction}|${e.building}|${e.name}`, unit);
	}
}

// Fallback: research keys often end in the unit they buff
// (e.g. Roots/Research/Glade/Stacksize/BrokenVessel, .../Human/MilitiaStackSize)
function matchByKey(faction: string, key: string): ResearchUnit | undefined {
	const seg = norm(key.split("/").pop() ?? "");
	if (seg.length < 4) return undefined;
	for (const [uid, unit] of unitByName) {
		if (!uid.startsWith(`${faction}|`)) continue;
		const n = norm(unit.name);
		if (n.length < 3) continue;
		if (seg === n || seg.startsWith(n) || n.startsWith(seg)) return unit;
	}
	return undefined;
}

/** Which unit (if any) each research stack of a faction applies to, by stack key. */
export function researchUnitMap(
	faction: string,
	stacks: { key: string; name: string; building: string }[],
): Record<string, ResearchUnit> {
	const out: Record<string, ResearchUnit> = {};
	for (const s of stacks) {
		const unit =
			byResearchName.get(`${faction}|${s.building}|${s.name}`) ??
			matchByKey(faction, s.key);
		if (unit) out[s.key] = unit;
	}
	return out;
}
