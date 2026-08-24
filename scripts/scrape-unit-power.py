"""Rebuild src/data/unitPower.json from the community "Unit Comparison" sheet.

Source thread (formulas, caveats, the strategy write-up):
  https://steamcommunity.com/app/867210/discussions/0/563659290304345947/

Two variants are emitted per unit, and /power-model/ documents the difference:

v4 — the sheet's numbers, recomputed from its raw stat columns with its own
formulas and validated against the Max Power / Efficiency cells it publishes
(the run aborts if any unit drifts by more than a rounding point). Melee:

    Off   = avgDmg x (100 + offence + offAbility%) / 100
    Def   = health x (100 + defence + defAbility%) / 100
    Power = troop x sqrt(Off x Def) / 10
    Eff   = sqrt(Off x Def) / unitGold x 1000

Ranged Off additionally multiplies attacks-per-round and the reach factor
(2 x deadlyRange + range) / 10. The Magic tab scales both: Power by
(34 + late-game essence value)/100 using per-school weights, Efficiency by
(70 + 15 x essences)/100 — deliberately different horizons (efficiency is an
early-game number, Power a late-game one).

adj — the same model with the Codex adjustments applied:

  1. The sheet's Mobility% column (25 + 15 x movement), computed there but
     referenced by no formula, multiplies melee Off — the melee analogue of
     the ranged reach factor.
  2. Initiative (from units.json; the sheet doesn't record it) scales Power
     by 0.5% per point from the roster median.
  3. Offence/defence score against the roster-median opponent with the
     community-established asymmetric rates (+1%/pt ahead, -0.5%/pt behind,
     clamped 1/3..3) instead of a fixed zero baseline.
  4. Troop size enters as troop^0.9 — a hedge against linear swarm scaling.
  5. Berserker gets one convention: inline modifiers stripped from the Rats
     and Plague Rats headline rows, and "(B)" berserk variants synthesised
     for Rats and Horned Ones with the sheet's own (B) pattern (+2 damage,
     -25 defence, +1 movement).
  6. Stack cost comes from units.json recruit prices (rares at 700g), which
     also fixes Elder Dragons being priced as the cumulative upgrade path.

The adjusted scores are then renormalised so their roster medians match the
v4 medians — one uniform factor for Power, one for Efficiency. Both scales
are synthetic, so this changes nothing relative; it just keeps the two
variants readable side by side.

Rows suffixed "(B)" are the same unit re-scored while berserking and fold
into the parent entry. The Experiments block (units paired with a specific
wielder and skill) is skipped — that isn't a property of the unit. Anything
the sheet doesn't score (Ballistae, Risen, Yulan's Tian/Feng/Transcendent
lines) is absent.
"""

import io
import json
import re
import statistics
import urllib.request
import zipfile
import xml.etree.ElementTree as ET
from decimal import Decimal, ROUND_HALF_UP

SHEET = "1PpcNV4tZ9hcAJgOmMN-A_r-SXJztSR7rf5mQezO5dqY"
URL = f"https://docs.google.com/spreadsheets/d/{SHEET}/export?format=xlsx"

NS = {
    "m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "pr": "http://schemas.openxmlformats.org/package/2006/relationships",
}

# the sheet's faction labels -> ours
FACTIONS = {
    "Arleon": "Arleon",
    "Loth": "Barony of Loth",
    "Barya": "Barya",
    "Rana": "Rana",
    "Vanir": "Vanir",
    "Roots": "Roots",
    "Yulan": "Yulan",
}

# names de-pluralising can't reach
OVERRIDE = {
    "Serimnaan": "Serimnann",
    "Eth'dra": "Eth'Dra",
    "Steam Pipers": "Steam piper",
    "Lobbers": "Lob",
    "Chuckers": "Chuck",
    "Hearts": "Heart",
    "Pulses": "Pulse",
    "Seeds of the Mother": "Seed of the Mother",
    "Roots of the Mother": "Roots of the Mother",
    "Fists of Order": "Fist of Order",
    "Riders of the Swamp": "Rider of the Swamp",
    "Shield of Order": "Shield of Order",
    "Scavenged Bones": "Scavenged Bones",
    "Blessed Bones": "Blessed Bones",
    "Fungi": "Fungi",
    "Hunger": "Hunger",
    "Dread": "Dread",
    "Terror": "Terror",
    "Hu": "Hu",
    "Jiuweihu": "Jiuweihu",
    "Nornor": "Nornor",
    "Crone": "Crone",
    "Korphan": "Korphan",
    "Bacahorse": "Bacahorse",
    "Lykt": "Lykt",
    "Lyktvaan": "Lyktvaan",
    "Troll": "Troll",
    "Grym": "Grym",
}

# ---- Guesstimates tab (validated against it at runtime) --------------------
RARE_GOLD = 700  # amber / celestial / glimmer, one flat market price
SCHOOL_WEIGHT = {"order": 40, "chaos": 25, "creation": 25, "destruction": 50, "arcana": 25}
ESSENCE_EARLY = 15
MAGIC_POWER_BASE = 34  # late-game baseline in (base + essence)/100
MAGIC_EFF_BASE = 70  # early/mid baseline

# ---- Codex adjustments (documented on /power-model/) -----------------------
RATE_UP = 0.01  # +1% damage per point of offence over defence
RATE_DOWN = 0.005  # -0.5% per point behind
CLAMP = (1 / 3, 3.0)
INIT_RATE = 0.005  # 0.5% Power per initiative point from the roster median
TROOP_EXP = 0.9
# strip the inline Berserker modifiers these headline rows carry in the sheet
BERSERK_INLINE = {"Rats", "Plague Rats"}
# synthesise missing "(B)" rows with the sheet's own pattern
BERSERK_SYNTH = {"Rats", "Horned Ones"}
BERSERK_DMG, BERSERK_DEF, BERSERK_MOVE = 2, -25, 1


def rnd(x, n=0):
    """Excel-style ROUND: half away from zero."""
    q = Decimal(1).scaleb(-n)
    return float(Decimal(repr(x)).quantize(q, rounding=ROUND_HALF_UP))


def sheets():
    """Every tab of the published workbook, cached values, as {name: rows}."""
    raw = urllib.request.urlopen(URL).read()
    z = zipfile.ZipFile(io.BytesIO(raw))

    strings = []
    for si in ET.fromstring(z.read("xl/sharedStrings.xml")).findall("m:si", NS):
        strings.append("".join(t.text or "" for t in si.iter("{%s}t" % NS["m"])))

    rels = {
        rel.get("Id"): rel.get("Target")
        for rel in ET.fromstring(z.read("xl/_rels/workbook.xml.rels")).findall(
            "pr:Relationship", NS
        )
    }

    def col(ref):
        n = 0
        for ch in re.match(r"[A-Z]+", ref).group():
            n = n * 26 + ord(ch) - 64
        return n - 1

    out = {}
    for sh in ET.fromstring(z.read("xl/workbook.xml")).find("m:sheets", NS):
        target = rels[sh.get("{%s}id" % NS["r"])]
        # rel targets are relative to xl/, except the rare absolute one
        path = target[1:] if target.startswith("/") else "xl/" + target
        root = ET.fromstring(z.read(path))
        rows = []
        for row in root.iter("{%s}row" % NS["m"]):
            cells = {}
            for c in row.findall("m:c", NS):
                v = c.find("m:v", NS)
                if v is None:
                    value = ""
                elif c.get("t") == "s":
                    value = strings[int(v.text)]
                else:
                    value = v.text
                cells[col(c.get("r"))] = value
            rows.append([cells.get(i, "") for i in range(max(cells) + 1)] if cells else [])
        out[sh.get("name")] = rows
    return out


def num(row, i, default=0.0):
    try:
        return float(row[i])
    except (IndexError, ValueError):
        return default


def singular(name):
    house = re.match(r"^(.*?) \((Li|Sheng|Xuan)\)$", name)
    if house:
        return f"{house.group(2)} {singular(house.group(1))}"
    if name in OVERRIDE:
        return OVERRIDE[name]
    if name.endswith("ies"):
        return name[:-3] + "y"
    if name.endswith("men"):
        return name[:-3] + "man"
    if name.endswith("s") and not name.endswith("ss"):
        return name[:-1]
    return name


def stat_rows(rows, role):
    """Raw stat dicts for every scored row of a *_Units_Might tab."""
    out = []
    faction = None
    for row in rows:
        if row and str(row[0]).strip() and str(row[0]).strip() in ("", None):
            continue
        if len(row) > 1 and str(row[1]).strip():
            faction = str(row[1]).strip()
        name = str(row[0]).strip() if row else ""
        if not name or faction not in FACTIONS or not num(row, 2):
            continue
        if role == "melee":
            r = {
                "troop": num(row, 2), "avg": num(row, 5), "health": num(row, 6),
                "off": num(row, 7), "def": num(row, 8), "move": num(row, 9),
                "gold": num(row, 10), "offAb": num(row, 12), "defAb": num(row, 13),
                "attacks": 1.0, "reach": 1.0,
                "sheetPower": num(row, 21), "sheetEff": num(row, 22),
            }
        else:
            r = {
                "troop": num(row, 2), "avg": num(row, 5), "health": num(row, 6),
                "off": max(num(row, 7), num(row, 8)), "def": num(row, 9),
                "move": num(row, 10), "gold": num(row, 13),
                "offAb": num(row, 15), "defAb": num(row, 16),
                "attacks": num(row, 14), "reach": (num(row, 12) * 2 + num(row, 11)) / 10,
                "sheetPower": num(row, 23), "sheetEff": num(row, 24),
            }
        r.update(faction=FACTIONS[faction], sheetName=name, role=role)
        out.append(r)
    return out


def essence_rows(rows):
    """(faction, name) -> {essenceValueLate, essenceValueEarly, sheet N, O}."""
    out = {}
    faction = None
    schools = ("order", "chaos", "creation", "destruction", "arcana")
    for row in rows:
        if len(row) > 1 and str(row[1]).strip():
            faction = str(row[1]).strip()
        name = str(row[0]).strip() if row else ""
        if not name or faction not in FACTIONS or name in ("Faction",):
            continue
        ess = {s: num(row, 4 + i) for i, s in enumerate(schools)}
        mag_ab = num(row, 10)
        late = rnd(sum(ess[s] * SCHOOL_WEIGHT[s] for s in schools) * (100 + mag_ab) / 100)
        early = rnd(sum(ess.values()) * ESSENCE_EARLY * (100 + mag_ab) / 100)
        out[(FACTIONS[faction], name)] = {
            "late": late, "early": early,
            "sheetPower": num(row, 13), "sheetEff": num(row, 14),
        }
    return out


def v4_scores(r):
    off = r["avg"] * r["attacks"] * (100 + r["off"] + r["offAb"]) / 100 * r["reach"]
    dfn = r["health"] * (100 + r["def"] + r["defAb"]) / 100
    if r["role"] == "ranged":
        off, dfn = rnd(off, 2), rnd(dfn, 2)
    prod = rnd(off * dfn)
    power = rnd(r["troop"] * prod**0.5 / 10)
    eff = rnd(rnd(prod**0.5 / r["gold"] * 100, 1) * 10)
    return power, eff


def differential(diff):
    """Damage multiplier for an offence-vs-defence gap of `diff` points."""
    m = 1 + (RATE_UP if diff >= 0 else RATE_DOWN) * diff
    return min(CLAMP[1], max(CLAMP[0], m))


def adj_scores(r, med, init, gold_stack):
    eff_off = r["off"] + r["offAb"]
    eff_def = r["def"] + r["defAb"]
    off_mult = differential(eff_off - med["def"])
    incoming = differential(med["off"] - eff_def)
    mobility = (25 + 15 * r["move"]) / 100 if r["role"] == "melee" else 1.0
    off = r["avg"] * r["attacks"] * r["reach"] * mobility * off_mult
    ehp = r["health"] / incoming
    init_mult = 1 + INIT_RATE * (init - med["init"]) if init is not None else 1.0
    power = r["troop"] ** TROOP_EXP * (off * ehp) ** 0.5 / 10 * init_mult
    eff = power / gold_stack * 10_000 if gold_stack else None
    return rnd(power), (rnd(eff) if eff is not None else None)


def magic_scores(power, eff, ess):
    return (
        rnd(power * (MAGIC_POWER_BASE + ess["late"]) / 100),
        rnd(eff * (MAGIC_EFF_BASE + ess["early"]) / 100),
    )


def known_units():
    """(faction, name) -> {initiative, goldEquiv} from units.json."""
    with open("src/data/units.json") as fh:
        units = json.load(fh)
    out = {}
    for u in units:
        tiers = [u["base"]] + ([u["upgraded"]] if "upgraded" in u else []) + u.get("upgrades", [])
        for t in tiers:
            m = re.search(r"\d+", t.get("initiative", "") or "")
            gold = sum(
                v * (1 if k == "gold" else RARE_GOLD) for k, v in t["cost"].items()
            )
            out[(u["faction"], t["name"])] = {
                "init": int(m.group()) if m else None,
                "gold": gold,
            }
    return out


def build():
    tabs = sheets()
    known = known_units()

    raw = stat_rows(tabs["Melee_Units_Might"], "melee") + stat_rows(
        tabs["Ranged_Units_Might"], "ranged"
    )
    essences = essence_rows(tabs["Melee_Units_Magic"]) | essence_rows(
        tabs["Ranged_Units_Magic"]
    )

    # medians over headline rows only — (B) rows are states, not units
    headline = [r for r in raw if not r["sheetName"].endswith("(B)")]
    med = {
        "off": statistics.median(r["off"] + r["offAb"] for r in headline),
        "def": statistics.median(r["def"] + r["defAb"] for r in headline),
        "init": statistics.median(
            known[(r["faction"], singular(r["sheetName"]))]["init"]
            for r in headline
            if (r["faction"], singular(r["sheetName"])) in known
            and known[(r["faction"], singular(r["sheetName"]))]["init"] is not None
        ),
    }
    print(f"medians: off {med['off']}, def {med['def']}, init {med['init']}")

    # synthesise the missing (B) rows with the sheet's own berserk pattern
    for r in [r for r in raw if r["sheetName"] in BERSERK_SYNTH]:
        b = dict(r)
        b.update(
            sheetName=f"{r['sheetName']} (B)", avg=r["avg"] + BERSERK_DMG,
            off=r["off"], offAb=0.0, defAb=0.0, move=r["move"] + BERSERK_MOVE,
            **{"def": r["def"] + BERSERK_DEF},
            sheetPower=0, sheetEff=0, synth=True,
        )
        raw.append(b)

    # ---- pass 1: compute both variants, validating v4 against the sheet ----
    computed = []
    drift = []
    unmatched = set()
    for r in raw:
        berserk = r["sheetName"].endswith("(B)")
        base_name = r["sheetName"][:-4].strip() if berserk else r["sheetName"]
        name = singular(base_name)
        if (r["faction"], name) not in known:
            unmatched.add(r["sheetName"])
            continue
        k = known[(r["faction"], name)]
        ess = essences.get((r["faction"], r["sheetName"])) or essences.get(
            (r["faction"], base_name)
        )
        if ess is None:
            unmatched.add(f"{r['sheetName']} (no essence row)")
            continue

        power, eff = v4_scores(r)
        m_power, m_eff = magic_scores(power, eff, ess)
        if not r.get("synth"):
            for label, ours, sheet in (
                ("power", power, r["sheetPower"]),
                ("eff", eff, r["sheetEff"]),
                ("magicPower", m_power, ess["sheetPower"]),
                ("magicEff", m_eff, ess["sheetEff"]),
            ):
                if sheet and abs(ours - sheet) > 1:
                    drift.append(f"{r['sheetName']} {label}: ours {ours} sheet {sheet}")

        a = dict(r)
        if not berserk and r["sheetName"] in BERSERK_INLINE:
            a["offAb"] = a["defAb"] = 0.0
        a_power, a_eff = adj_scores(a, med, k["init"], r["troop"] * k["gold"])
        computed.append({
            "key": f"{r['faction']}|{name}", "role": r["role"], "berserk": berserk,
            "synth": bool(r.get("synth")), "ess": ess,
            "v4": (power, eff, m_power, m_eff), "adjRaw": (a_power, a_eff),
        })

    if drift:
        raise SystemExit("v4 recomputation drifted from the sheet:\n" + "\n".join(drift))

    # ---- renormalise adj to the v4 medians (uniform, purely presentational) --
    head = [c for c in computed if not c["berserk"]]
    f_power = statistics.median(c["v4"][0] for c in head) / statistics.median(
        c["adjRaw"][0] for c in head
    )
    f_eff = statistics.median(c["v4"][1] for c in head) / statistics.median(
        c["adjRaw"][1] for c in head
    )
    print(f"renormalise adj: power x{f_power:.3f}, eff x{f_eff:.3f}")

    # ---- pass 2: assemble ----
    out = {}
    for c in computed:
        power, eff, m_power, m_eff = c["v4"]
        a_power = rnd(c["adjRaw"][0] * f_power)
        a_eff = rnd(c["adjRaw"][1] * f_eff)
        am_power, am_eff = magic_scores(a_power, a_eff, c["ess"])
        entry = out.setdefault(c["key"], {"role": c["role"]})
        v4 = {"might": {"power": int(power), "eff": int(eff)},
              "magic": {"power": int(m_power), "eff": int(m_eff)}}
        adj = {"might": {"power": int(a_power), "eff": int(a_eff)},
               "magic": {"power": int(am_power), "eff": int(am_eff)}}
        if c["berserk"]:
            if not c["synth"]:
                entry.setdefault("v4", {})["berserk"] = v4
            entry.setdefault("adj", {})["berserk"] = adj
        else:
            entry.setdefault("v4", {}).update(v4)
            entry.setdefault("adj", {}).update(adj)
    if unmatched:
        print("no unit matches:", ", ".join(sorted(unmatched)))
    print("unscored:", ", ".join(sorted(f"{f}|{n}" for f, n in known if f"{f}|{n}" not in out)))

    with open("src/data/unitPower.json", "w") as fh:
        json.dump(dict(sorted(out.items())), fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    print(f"wrote {len(out)} units (v4 validated against the sheet, adj recomputed)")


if __name__ == "__main__":
    build()
