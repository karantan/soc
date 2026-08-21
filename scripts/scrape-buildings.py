"""Rebuild src/data/buildings.json from the Songs of Conquest wiki Building infoboxes.

Fields we care about (see Template:Building):
  cost/wood/stone/glimmerweave/ancientamber/celestialore  tier 1 build cost
  upgrade*                                                 tier 2 cost (upgrade*2 -> T3, *3 -> T4)
  prereq{N}                                                buildings this tier requires
  reqforthistown{N}                                        buildings this tier unlocks (reverse edge)
  unitproduce{N} / unitprodimp{N}                          troops per round, plain and with the improvement
  improvename/improvecost/improve*                         the one-off building improvement
"""

import json
import re
import time
import urllib.parse
import urllib.request

API = "https://songsofconquest.fandom.com/api.php?"
RES = [
    ("cost", "gold"),
    ("wood", "wood"),
    ("stone", "stone"),
    ("glimmerweave", "glimmer"),
    ("ancientamber", "amber"),
    ("celestialore", "celestial"),
]


def api(**params):
    params["format"] = "json"
    url = API + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": "soc-codex-scraper"})
    return json.load(urllib.request.urlopen(req))


def wikitext_of(titles):
    out = {}
    for i in range(0, len(titles), 20):
        d = api(
            action="query",
            prop="revisions",
            rvprop="content",
            rvslots="main",
            titles="|".join(titles[i : i + 20]),
        )
        for page in d["query"]["pages"].values():
            try:
                out[page["title"]] = page["revisions"][0]["slots"]["main"]["*"]
            except (KeyError, IndexError):
                continue
        time.sleep(0.2)
    return out


def infobox(text):
    """Field -> raw value for the leading {{Building|...}} call."""
    head = text[: text.find("}}") + 2]
    return {
        k: v.strip() for k, v in re.findall(r"\|\s*([a-zA-Z0-9]+)\s*=\s*([^|\n}]*)", head)
    }


def links(value):
    """'[[Crypt]] Tier 2' -> [{'name': 'Crypt', 'note': 'Tier 2'}]"""
    out = []
    for raw in re.split(r"<br\s*/?>|,", value or ""):
        m = re.search(r"\[\[([^\]|]+)(?:\|[^\]]+)?\]\]", raw)
        if not m:
            continue
        note = re.sub(r"\[\[[^\]]+\]\]", "", raw).strip(" .")
        out.append({"name": m.group(1).strip(), **({"note": note} if note else {})})
    return out


# Wiki names that do not normalise onto a units.json name.
ALIASES = {
    "Shields of Order": "Shield of Order",
    "Serimnaans": "Serimnann",
    "Adult Crawler": "Burrower",
}


def produced(value):
    """'2 [[Cultists]]' / '2 [[Footmen]] (Garrison)<br>2 [[Militia]] (Garrison)'"""
    out = []
    for part in re.split(r"<br\s*/?>", value or ""):
        m = re.match(r"\s*(\d+)\s*\[\[([^\]|]+)(?:\|[^\]]+)?\]\]\s*(.*)", part)
        if not m:
            continue
        unit = m.group(2).strip()
        entry = {"count": int(m.group(1)), "unit": ALIASES.get(unit, unit)}
        if "garrison" in m.group(3).lower():
            entry["garrison"] = True
        out.append(entry)
    return out


def cost(fields, prefix):
    out = {}
    for field, name in RES:
        key = prefix + field if prefix else field
        value = fields.get(key, "")
        if re.fullmatch(r"\d+", value or ""):
            out[name] = int(value)
    return out


def plain(value):
    """Strip wiki markup from a description."""
    value = re.sub(r"\[\[([^\]|]+\|)?([^\]]+)\]\]", r"\2", value or "")
    return re.sub(r"'{2,}|<br\s*/?>", " ", value).strip()


def build():
    titles = [
        m["title"]
        for m in api(
            action="query",
            list="categorymembers",
            cmtitle="Category:Buildings",
            cmlimit="500",
        )["query"]["categorymembers"]
    ]
    pages = wikitext_of(titles)

    out = {}
    for title, text in sorted(pages.items()):
        f = infobox(text)
        tiers = []
        # tier 1, then the upgrade chain: upgrade*, upgrade*2, upgrade*3
        for index, prefix in enumerate(["", "upgrade", "upgrade", "upgrade"]):
            n = index + 1
            if n > 1 and not f.get(f"hasT{n}"):
                break
            suffix = "" if n <= 2 else str(n - 1)
            pref = prefix if n == 1 else prefix
            c = (
                cost(f, "")
                if n == 1
                else {
                    name: int(v)
                    for field, name in RES
                    for v in [f.get(f"{pref}{field}{suffix}", "")]
                    if re.fullmatch(r"\d+", v or "")
                }
            )
            tier = {"tier": n, "cost": c}
            key = "" if n == 1 else str(n)
            if f.get(f"prereq{key}"):
                tier["requires"] = links(f[f"prereq{key}"])
            if f.get(f"reqforthistown{key}"):
                tier["unlocks"] = links(f[f"reqforthistown{key}"])
            if f.get(f"unitproduce{key}"):
                tier["produces"] = produced(f[f"unitproduce{key}"])
            if f.get(f"unitprodimp{key}"):
                tier["producesImproved"] = produced(f[f"unitprodimp{key}"])
            tiers.append(tier)

        entry = {
            "faction": plain(f.get("faction", "")) or None,
            "size": f.get("size") or None,
            "tiers": tiers,
        }
        if f.get("improvename"):
            entry["improvement"] = {
                "name": plain(f["improvename"]),
                "cost": cost(f, "improve"),
                "description": plain(f.get("improvedescription", "")) or None,
            }
        if f.get("reqforglobal"):
            entry["globalUnlock"] = links(f["reqforglobal"])
        out[title] = entry

    with open("src/data/buildings.json", "w") as fh:
        json.dump(out, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    print(f"wrote {len(out)} buildings")


if __name__ == "__main__":
    build()
