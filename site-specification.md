# Site Specification

## Configuration
- **Site Type**: General (game data reference / comparison tool, local-only)
- **Design Language (Starting Point)**: Dark
- **Target Audience**: Songs of Conquest players comparing faction unit stats
- **Primary Goal**: Fast side-by-side unit stat comparison between factions

## Design Evolution
- **Starting aesthetic**: Dark design language adapted into a "dark fantasy codex" — deep marsh-night green-black background with layered radial gradients, aged-parchment foreground, burnished-gold primary.
- **User customizations**: None yet — initial build.
- **Current style**:
  - Background `hsl(150 25% 6%)`, foreground `hsl(40 35% 87%)`, gold primary `hsl(42 55% 58%)`.
  - Faction accent colors: Rana swamp green `hsl(100 45% 52%)`, Barony of Loth necrotic violet `hsl(268 40% 62%)` (exposed as `text-rana` / `text-loth` / `*-soft` Tailwind utilities).
  - Fonts via Astro Fonts API: **Cinzel** (variable 400–900, display/headings, `--font-cinzel`) + **Spectral** (body, `--font-spectral`).
  - Sticky blurred header, gold CTA, faction-tinted card borders.

## Pages
- `/` — hero + faction cards linking to detail pages and the compare tool.
- `/compare/` — main feature: React island (`src/components/CompareTable.tsx`) with faction filter, base/upgraded/both tier toggle, sortable columns, best-value-per-column highlighted in gold. ⚔ buttons pick two units for a head-to-head duel panel with per-stat winner highlighting (picks persist across filter changes; third pick replaces the oldest).
- `/factions/rana/`, `/factions/barony-of-loth/` — magic affinity summary + per-unit cards showing base vs upgraded side by side.
- `/wielders/` — React island (`src/components/WielderBrowser.tsx`): all 64 wielders in a sortable table (Off/Def/Move/View/Command) with faction filter, portraits, class, skills, specialization and starting troops. Wide layout. 47 portraits sourced from wiki `*Head.png` / `Icon_wielder_*` files (`public/images/wielders/`); the rest render an initial-letter placeholder (no art exists on the wiki — includes most Yulan wielders, whose table is also partly blank there).
- `/spells/` — React island (`src/components/SpellBrowser.tsx`): all 40 spells (20 pure, 20 dyad) as cards with essence costs, duration and effects; filters for essence school, dyads, faction affinity (spells fully fueled by a faction's own troops), and tier 1/2/3 switching.

## Data
- `src/data/units.json` — 65 units across all 7 factions (Arleon, Rana, Barya, Barony of Loth, Vanir, Roots, Yulan) scraped from the fandom wiki faction pages via the MediaWiki API on 2026-08-08. Yulan's Grenadier and Seeker lines have no portraits (none exist on the wiki). Some units genuinely produce doubled essence (e.g. Musketeer 2× Order) — not a scrape artifact.
- `src/data/factionStyles.ts` — literal Tailwind class strings per faction (JIT can't see dynamic class names); faction colors defined in `src/index.css` (`--arleon` blue, `--rana` green, `--barya` amber, `--loth` violet, `--vanir` ice, `--roots` moss, `--yulan` plum).
- `src/data/factions.ts` — faction metadata (taglines, magic order, notes, wiki links).
- `src/data/spells.json` — all 40 spells scraped from the wiki Magic page (essences, duration, tier 1–3 effects) on 2026-08-08.
- `public/images/spells/` — 40 spell icons cropped from the wiki's `Spell_Table.png` in-game screenshot (the wiki only hosts 8 individual spell icon files); icon-to-name mapping follows the Magic page summary-table grid positions. Crop script pattern lives with the scrapers described below.
- `public/images/units/` — unit portraits + essence/resource icons downloaded from the wiki CDN.
- Local-only fan reference; wiki attribution in the footer.

## Tooltips
- `src/data/abilityDescriptions.json` — description for every unit special/ability token (86 entries). Sources, in priority order: soc.th.gl scraped text / game termMap → composed from datamined modifier/aura data (github.com/lmachens/soc.th.gl `lib/collections/`, June 2026) → 6 handcrafted trait fallbacks (Berserker, Charger, etc.).
- `src/data/skillDescriptions.json` — wielder skill/power effects per level (wiki Skills page) + icon filename map; icons in `public/images/skills/` cropped from soc.th.gl's CDN icon atlas.
- `src/components/Tip.tsx` — fixed-position hover tooltip (`Tip`) + `AbilityTokens` (splits special/ability strings into hoverable tokens); `SkillChips.tsx` renders wielder skills as icon chips with per-level tooltips. Used in CompareTable (incl. duel panel) and WielderBrowser; faction pages use native `title` tooltips.
- Ability names in units.json were refreshed against the datamined data where the wiki was stale (e.g. Seneschal's ability is now Wait, the Hunger unit's ability is Feed).

## Notes
- To add a faction: scrape its wiki page, append to `units.json`, add entries to `factions.ts` + `factionStyles.ts` + a color in `index.css` — nav, home, compare filters, spell affinity filters and faction pages all derive from `factions.ts` automatically.
- Dev server: `.devenv/`/`.direnv` (direnv + nix) are excluded from the vite watcher in `astro.config.mjs` — without that the watcher follows nix-store symlink loops (apple-sdk ncurses) and floods ELOOP unhandled rejections.
- Spell icon mapping was verified against the badge colors in the in-game screenshot (each cost badge's color encodes its essence school); the dyad grid order differs from the wiki Magic page's summary table.
