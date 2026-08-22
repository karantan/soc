"""Rebuild src/data/changelog.json from songsofconquest.com/changelog-archive.

The archive is one long page: version headers ("Changelog v1.9 — MARCH 5, 2026",
"HOTFIX 1.9.1 -"), then section headers ("Battle", "Game balance", ...), then one
line per change. Every change line is scanned for the names we already carry in
src/data, so a unit page can show only the patches that touched it.
"""

import html
import json
import re
import urllib.request

URL = "https://www.songsofconquest.com/changelog-archive"

# Repeated headings on the page that group changes, plus site chrome to drop.
SECTIONS = {
    "Notable additions", "Notable bug fixes", "Additions", "Adventure", "Battle",
    "UI", "Misc", "Multiplayer", "Audio", "Random Map Generator", "Map Editor",
    "Map editor", "Modding", "Common", "Campaigns", "Known Issues", "AI",
    "AI - Adventure", "AI - Battle", "AI Adventure", "AI Battle",
    "Fixes & Improvements", "Game balance", "Optimizations", "Gameplay changes",
    "Gameplay", "Map changes", "Optimization", "Main menus", "Artwork",
    "Spell changes", "Battlegrounds", "Random", "Bug fixes", "Balance",
    "Balancing", "Performance", "Localization", "Tutorial", "Achievements",
}
CHROME = {
    "Home", "About", "Media", "Community", "Press", "Devblog", "Scroll", "***",
    "A Classic Adventure Strategy Game", "Songs of conquest", "Changelog Archive",
    "review chagelogs for older versions", "ChangelogFeed RSS",
    "Changelog archive — Songs of Conquest", "Privacy policy", "clicking here",
}

MONTHS = {
    m: i + 1
    for i, m in enumerate(
        "january february march april may june july august september october "
        "november december".split()
    )
}


def iso_date(text):
    m = re.search(r"([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})", text or "")
    if not m or m.group(1).lower() not in MONTHS:
        return None
    return f"{m.group(3)}-{MONTHS[m.group(1).lower()]:02d}-{int(m.group(2)):02d}"


def page_lines():
    req = urllib.request.Request(URL, headers={"User-Agent": "soc-codex"})
    raw = urllib.request.urlopen(req).read().decode("utf-8", "replace")
    body = re.sub(r"<(script|style)[^>]*>.*?</\1>", "", raw, flags=re.S | re.I)
    body = html.unescape(re.sub(r"<[^>]+>", "\n", body))
    return [l.strip() for l in body.split("\n") if l.strip()]


def normalize(text):
    """The site uses curly quotes and en dashes; our data uses plain ASCII."""
    return (
        (text or "")
        .replace("\u2019", "'")
        .replace("\u2018", "'")
        .replace("\u201c", '"')
        .replace("\u201d", '"')
    )


def names_from_data():
    """name -> (kind, canonical) for everything we can link a change to."""
    out = {}

    def add(name, kind, canonical=None):
        name = normalize(name).strip()
        if len(name) < 3:
            return
        out.setdefault(name, (kind, canonical or name))

    units = json.load(open("src/data/units.json"))
    for u in units:
        for tier in [u["base"], u.get("upgraded"), *(u.get("upgrades") or [])]:
            if tier:
                add(tier["name"], "unit", tier["name"])
        add(u["faction"], "faction", u["faction"])
    for w in json.load(open("src/data/wielders.json")):
        add(w["name"], "wielder")
    for s in json.load(open("src/data/spells.json")):
        add(s["name"], "spell")
    for a in json.load(open("src/data/artifacts.json")):
        add(a["name"], "artifact")
    skills = json.load(open("src/data/skillDescriptions.json"))
    for name in [*skills["skills"], *skills["powers"]]:
        add(name, "skill")
    for name in json.load(open("src/data/buildings.json")):
        add(name, "building")
    return out


# Words that turn a bare unit name into something else: Rana's Guard vs the
# Guard skill, a Guard Tower, or an AI "Stand Guard" behaviour.
CONTEXT_BLOCK = re.compile(r"(skill|trait|behaviou?r|tower|ability|research)", re.I)


def tag(line, names):
    """Known names mentioned in a change line.

    Longest name first, and a match only counts if it does not sit inside one
    already claimed — otherwise "Scarred Brute" also reports Brute, and every
    Guard Tower line looks like a change to Rana's Guard.
    """
    line = normalize(line)
    ambiguous = {
        n for n in names if " " not in n and sum(1 for x in names if x == n) > 0
    }
    found = {}
    claimed = []
    for name in sorted(names, key=len, reverse=True):
        kind, canonical = names[name]
        # plural forms appear constantly ("Faey Nobles", "Necromancers")
        for m in re.finditer(rf"\b{re.escape(name)}(?:s|es)?\b", line, re.I):
            if any(m.start() >= a and m.end() <= b for a, b in claimed):
                continue
            # entities are capitalised; "guard the flank" is not Rana's Guard
            if not m.group(0)[:1].isupper():
                continue
            if kind == "unit" and name in ambiguous:
                before = line[max(0, m.start() - 26) : m.start()]
                after = line[m.end() : m.end() + 12]
                if CONTEXT_BLOCK.search(before) or CONTEXT_BLOCK.search(after):
                    continue
            claimed.append((m.start(), m.end()))
            found.setdefault(kind, set()).add(canonical)
    return {k: sorted(v) for k, v in found.items()}


def build():
    lines = page_lines()
    names = names_from_data()

    versions, changes = [], []
    version = date = section = None
    pending_hotfix = None

    for line in lines:
        if line in CHROME:
            continue
        m = re.match(r"^Changelog\s+v?([\d.]+)\s*[—–\-]\s*(.+)$", line)
        if m:
            version, date, section = m.group(1), iso_date(m.group(2)), None
            versions.append({"version": version, "date": date, "raw": m.group(2)})
            continue
        m = re.match(r"^(?:HOTFIX|Hotfix)\s+([\d.]+)\s*[—–\-]?\s*(.*)$", line)
        if m:
            version, section = m.group(1), None
            date = iso_date(m.group(2))
            pending_hotfix = None if date else version
            versions.append({"version": version, "date": date, "hotfix": True})
            continue
        if pending_hotfix and iso_date(line):
            date = iso_date(line)
            for v in versions:
                if v["version"] == pending_hotfix:
                    v["date"] = date
            pending_hotfix = None
            continue
        if line in SECTIONS:
            section = line
            continue
        if re.match(r"^Changelog\b", line):
            continue
        if not version or len(line) < 12:
            continue
        text = re.sub(r"^[—–\-•*]+\s*", "", line)
        entry = {"version": version, "date": date, "text": text}
        if section:
            entry["section"] = section
        hits = tag(text, names)
        if hits:
            entry["tags"] = hits
        changes.append(entry)

    # the archive repeats a few version blocks (v0.90 is listed twice with
    # different dates); identical lines inside one version are the same change
    seen = set()
    deduped = []
    for c in changes:
        key = (c["version"], c.get("section"), c["text"])
        if key in seen:
            continue
        seen.add(key)
        deduped.append(c)
    changes = deduped

    # newest first, matching how the page reads
    order = {v["version"]: i for i, v in enumerate(versions)}
    changes.sort(key=lambda c: order.get(c["version"], 1e9))

    unique_versions = []
    for v in versions:
        if not any(u["version"] == v["version"] for u in unique_versions):
            unique_versions.append(v)

    data = {
        "source": URL,
        "versions": unique_versions,
        "changes": changes,
    }
    with open("src/data/changelog.json", "w") as fh:
        json.dump(data, fh, indent=1, ensure_ascii=False)
        fh.write("\n")
    tagged = sum(1 for c in changes if "tags" in c)
    print(f"{len(data['versions'])} versions, {len(changes)} changes, {tagged} tagged")


if __name__ == "__main__":
    build()
