"""Cross-check the data we ship against the numbers in the changelog.

The site's spell and unit values came from a snapshot; the changelog archive is
the running record of every balance change since. When the two disagree the
changelog wins, and that is exactly how Chain Lightning was sitting at its
pre-1.1 cost and Boiling Blood at its pre-1.7.3 damage.

This doesn't try to auto-apply anything — a line like "Rupture does more damage
on tier 2 and 3" carries no number to apply. It surfaces every changelog line
that mentions a thing we carry *and* contains a number, newest first, next to
what we currently store, so the numbers can be adjudicated by eye.

    python3 scripts/audit-changelog.py             # spells (the default)
    python3 scripts/audit-changelog.py units       # unit stats
    python3 scripts/audit-changelog.py buildings   # build costs and troop growth
    python3 scripts/audit-changelog.py all

Reading the output: a line whose numbers already match what we store is
confirmation, not drift. What matters is the newest line per entry — an old
"cost raised to 5" that a later patch overrode is history, not a correction.

And the archive is NOT exhaustive, which is the trap. Fireball proves it: 0.79
records "Damage of Fireball increased to 35/70/100", we ship 30/60/90, and
1.7.3's "Raise cost of Fireball from 14 to 15" matched our stored cost exactly
— so our snapshot was current as of Nov 2025 and the damage went back to
30/60/90 in some patch nobody wrote down. So a pre-1.0 line disagreeing with
what we ship is not evidence of drift on its own.

The bar worth applying: correct a value only when a 1.x line states an explicit
destination for it, ideally with a "from" that matches what we already store.
Older lines, and lines that only give a direction ("does more damage on tier 2
and 3"), are for reading, not for applying.
"""

import json
import re
import sys

DAMAGE = re.compile(r"(?<![+-])\b(\d+)(\s+damage\b)", re.I)
HAS_NUMBER = re.compile(r"\d")
# lines about AI behaviour, VFX or bug fixes carry numbers but never balance
NOISE = re.compile(
    r"\b(AI|VFX|achievement|soft ?lock|animation|tooltip|description|targeting)\b", re.I
)


def load(name):
    with open(f"src/data/{name}.json") as fh:
        return json.load(fh)


def version_rank(changelog):
    """Newest first — the order the archive itself reads in."""
    return {v["version"]: i for i, v in enumerate(changelog["versions"])}


def relevant(changelog, name):
    """Changelog lines naming `name` that carry a number and look like balance."""
    rank = version_rank(changelog)
    word = re.compile(r"\b" + re.escape(name) + r"\b", re.I)
    hits = [
        c
        for c in changelog["changes"]
        if word.search(c.get("text", ""))
        and HAS_NUMBER.search(c["text"])
        and not NOISE.search(c["text"])
    ]
    hits.sort(key=lambda c: rank.get(c.get("version", ""), 10**6))
    # the archive repeats some lines across a release and its hotfix
    seen, out = set(), []
    for c in hits:
        if c["text"] in seen:
            continue
        seen.add(c["text"])
        out.append(c)
    return out


def audit_spells(changelog):
    print("=" * 78)
    print("SPELLS")
    print("=" * 78)
    flagged = 0
    for s in load("spells"):
        hits = relevant(changelog, s["name"])
        if not hits:
            continue
        cost = "+".join(f"{n} {k}" for k, n in s["essences"].items())
        dmg = [m.group(1) if (m := DAMAGE.search(t)) else "-" for t in s["tiers"]]
        flagged += 1
        print(f"\n### {s['name']}")
        print(f"    we ship: cost {cost}; damage {'/'.join(dmg)}")
        for c in hits:
            print(f"    [{c['version']:8s} {c.get('date') or '':10s}] {c['text'][:110]}")
    print(f"\n{flagged} spells have numeric changelog history to check.")


def audit_buildings(changelog):
    """Where the balance changes actually land — costs and troop generation.

    Worth knowing before acting on anything here: buildings.json is scraped from
    the wiki and is not one consistent vintage. Lean-To carries its post-1.6.3
    generation while Faey Grove carried its pre-1.6.3 one, from the same patch.
    So a relative line ("cost lowered by 100 gold") cannot be applied to a
    stored value — there is no telling which side of the patch that value is on.
    """
    print("=" * 78)
    print("BUILDINGS")
    print("=" * 78)
    flagged = 0
    for name, entry in load("buildings").items():
        hits = relevant(changelog, name)
        if not hits:
            continue
        flagged += 1
        print(f"\n### {name} ({entry['faction']})")
        for t in entry.get("tiers", []):
            produces = ", ".join(
                f"{p['count']}x {p['unit']}" for p in t.get("produces", [])
            )
            print(f"    we ship: t{t['tier']} cost {json.dumps(t.get('cost'))}  [{produces}]")
        for c in hits:
            print(f"    [{c['version']:8s} {c.get('date') or '':10s}] {c['text'][:110]}")
    print(f"\n{flagged} buildings have numeric changelog history to check.")


def audit_units(changelog):
    print("=" * 78)
    print("UNITS")
    print("=" * 78)
    flagged = 0
    for u in load("units"):
        tiers = [u["base"]] + (
            [u["upgraded"]] if "upgraded" in u else []
        ) + u.get("upgrades", [])
        for t in tiers:
            hits = relevant(changelog, t["name"])
            if not hits:
                continue
            flagged += 1
            print(f"\n### {t['name']} ({u['faction']})")
            print(
                f"    we ship: dmg {t.get('damage')}; hp {t.get('health')}; "
                f"off {t.get('offence')}; def {t.get('defence')}; "
                f"init {t.get('initiative')}; cost {t.get('cost')}"
            )
            for c in hits:
                print(f"    [{c['version']:8s} {c.get('date') or '':10s}] {c['text'][:110]}")
    print(f"\n{flagged} unit tiers have numeric changelog history to check.")


def main():
    what = sys.argv[1] if len(sys.argv) > 1 else "spells"
    changelog = load("changelog")
    print(f"source: {changelog['source']}\n")
    if what in ("spells", "all"):
        audit_spells(changelog)
    if what in ("units", "all"):
        audit_units(changelog)
    if what in ("buildings", "all"):
        audit_buildings(changelog)


if __name__ == "__main__":
    main()
