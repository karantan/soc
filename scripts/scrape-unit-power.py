"""Rebuild src/data/unitPower.json from the community "Unit Comparison" sheet.

Source thread (formulas, caveats, the strategy write-up):
  https://steamcommunity.com/app/867210/discussions/0/563659290304345947/

The sheet has one Summary tab per scoring model — Summary_Might (bodies only)
and Summary_Magic (bodies plus the value of the essence a unit feeds your
wielder's spells). Each has two unit blocks side by side, melee on the left and
ranged on the right, both giving Max Power and Efficiency:

  Faction | Melee | Max Power | Efficiency | | Ranged | Max Power | Efficiency

Power is a full-stack combat score, Efficiency is Power per 1,000 gold of stack
cost. Both are synthetic — only their ranking against each other means anything.

The sheet's names are plural and use a "Yi (Li)" suffix for the Yulan house
variants, so they're normalised back to the singular, prefixed names units.json
uses. Rows suffixed "(B)" are the same unit re-scored with its Berserker passive
firing and are folded into the parent entry. Anything the sheet doesn't score
(Ballistae, Risen, Yulan's Tian/Feng/Transcendent lines) is simply absent, and
the Experiments block — units paired with a specific wielder and skill — is
skipped, since it isn't a property of the unit.
"""

import csv
import io
import json
import re
import urllib.request
import zipfile
import xml.etree.ElementTree as ET

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


def sheets():
    """Every tab of the published workbook, as {name: [[cell, ...], ...]}."""
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


def summary(rows):
    """(faction, name, role, power, efficiency) for every scored unit."""
    out = []
    faction = None
    for row in rows:
        row = list(row) + [""] * (8 - len(row))
        if row[0].strip():
            faction = row[0].strip()
        if faction not in FACTIONS:  # header rows, blank rows, Experiments
            continue
        for role, (n, p, e) in (("melee", (1, 2, 3)), ("ranged", (5, 6, 7))):
            if not row[n].strip() or not row[p].strip():
                continue
            out.append(
                (FACTIONS[faction], row[n].strip(), role, float(row[p]), float(row[e]))
            )
    return out


def known_units():
    with open("src/data/units.json") as fh:
        units = json.load(fh)
    names = set()
    for u in units:
        names.add((u["faction"], u["base"]["name"]))
        if "upgraded" in u:
            names.add((u["faction"], u["upgraded"]["name"]))
        for up in u.get("upgrades", []):
            names.add((u["faction"], up["name"]))
    return names


def build():
    tabs = sheets()
    known = known_units()
    out = {}
    unmatched = set()

    for model, tab in (("might", "Summary_Might"), ("magic", "Summary_Magic")):
        for faction, label, role, power, eff in summary(tabs[tab]):
            berserk = label.endswith("(B)")
            name = singular(label[:-4].strip() if berserk else label)
            if (faction, name) not in known:
                unmatched.add(label)
                continue
            entry = out.setdefault(f"{faction}|{name}", {"role": role})
            slot = entry.setdefault("berserk", {}) if berserk else entry
            slot[model] = {"power": round(power), "eff": round(eff)}

    if unmatched:
        print("no unit matches:", ", ".join(sorted(unmatched)))
    print("unscored:", ", ".join(sorted(f"{f}|{n}" for f, n in known if f"{f}|{n}" not in out)))

    with open("src/data/unitPower.json", "w") as fh:
        json.dump(dict(sorted(out.items())), fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    print(f"wrote {len(out)} units")


if __name__ == "__main__":
    build()
