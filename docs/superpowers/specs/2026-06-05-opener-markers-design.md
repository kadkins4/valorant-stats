# Opening-duel markers + win-rate stat — Design

**Date:** 2026-06-05
**Status:** Approved (brainstorm complete)
**Series:** Bucket C enrichment, Piece 2 (after Single-Duel Focus, 2026-06-03)

## Summary

Surface the already-captured `opener` flag on FragsMap. An "opening duel" is the
round's first kill with Kendall personally in it (killer or victim); `won` on that
duel means he won the entry (first blood) vs. lost it (first death). The flag rides
`Duel` → `Placed` today but is surfaced **nowhere**. This feature adds three
surfacing layers — a map marker, an aggregate stat, and a filter — with **no data
recapture and no new captured fields**.

## Decisions (locked in brainstorm)

- **Marker:** a gold halo ring around opener dots.
- **Stat:** both a headline chip and a per-region "Opener %" column.
- **Filter:** a two-state toggle, `All duels` (default) and `Openers`.

## Components & data flow

### 1. Openers filter (foundation)

Add `openersOnly?: boolean` to `FilterOpts` and apply it in `collectDuels`, the
same chokepoint as the Side filter:

```ts
if (o.openersOnly) duels = duels.filter((d) => d.opener);
```

Filtering at this single point means the whole downstream pipeline — `placeDuels`,
region assignment, `buildRegionModel`, breakdown rows, zoom bounds, and the heatmap
(`RegionView`) — operates on one consistent set with aligned indices. The heatmap
view gets opener-filtering for free (a heatmap of just opening duels = where entries
are won/lost).

UI: a new control group `OPENING DUELS` with two pills `[All duels] [Openers]`,
styled like the existing LAYER toggle (`chip()` helper). Default `All duels`.
Toggling resets the zoom via the existing `onFilter` wrapper (same as Map/Side/Season).

The existing empty-state ("No duels for this filter…") covers the case where a map
has no openers in the current scope — no new empty state needed.

### 2. Marker — gold halo ring

In `DuelMap.tsx`, `dot(i)` draws a gold ring when `points[i].opener`:

- `<circle r≈3 fill="none" stroke="#ffd166" strokeWidth=0.5 opacity≈0.9>` at the
  dot's render position, **under** the kill/death glyph so the glyph stays crisp.
- Keyed off `renderPos(i)`, so it follows the dot as a singleton, as a fanned
  cluster handle, and when focused.

Plus a `⚡ Opening duel` row in the duel dialog when the focused duel is an opener —
that is where someone inspecting a single duel expects to learn it was the entry.

The `<svg>` is `aria-hidden`; the ring is decorative. Opener information reaches
keyboard/SR users through the breakdown table (below).

### 3. Win-rate stat — chip + column

New pure module `lib/fightmap/openers.ts`:

- `openerStat(points: Placed[]): { won: number; total: number; rate: number }` —
  tallies `p.opener` duels and wins. `rate` is `won / total` (0 when `total === 0`).
- `openerByRegion(points: Placed[], assignment: number[], n: number):
{ won: number; total: number }[]` — per-region opener tally, indexed to match the
  regions array.

**Chip:** new presentational `OpenerStat` component rendered above the map:
`⚡ Opening duels · 14/22 won · 64%`. Scoped to the current Map/Side/Season set
(a stable headline; **not** re-scoped on zoom). Hidden when `total === 0`. Win-rate
number tinted with the existing `winRateColor`.

**Column:** `buildRegionRows` gains the per-region opener tally and exposes opener
fields on `RegionRow`; `BreakdownTable`'s overview table gains an "Opener %" column.
`DuelRow` gains `opener: boolean`; the zoomed duel table shows a `⚡` in the Outcome
cell and includes "opening duel" in the row's `aria-label`.

## Files touched

| File                                     | Change                                                       |
| ---------------------------------------- | ------------------------------------------------------------ |
| `lib/fightmap.ts`                        | `FilterOpts.openersOnly`; `collectDuels` filter              |
| `lib/fightmap/openers.ts`                | **new** — `openerStat`, `openerByRegion` (pure, unit-tested) |
| `lib/fightmap/breakdown.ts`              | opener fields on `RegionRow`/`DuelRow`; updated labels       |
| `components/fightmap/DuelMap.tsx`        | ring in `dot()`; dialog opener row                           |
| `components/fightmap/FightMap.tsx`       | toggle state, chip, wiring through `collectDuels`            |
| `components/fightmap/BreakdownTable.tsx` | "Opener %" column; `⚡` mark in duel rows                    |
| `components/fightmap/OpenerStat.tsx`     | **new** — the chip                                           |

## Testing

- **Unit (TDD):** `openerStat` and `openerByRegion` edge cases (no openers, all
  openers, partial); `collectDuels` `openersOnly` filtering; `buildRegionRows` /
  `buildDuelRows` opener fields and labels.
- **Smoke (Playwright, light):** the opener chip renders; the `Openers` toggle
  reduces the visible dot count vs. `All duels`.

## Scope guard (out)

- No data recapture; no new captured fields. `opener` already exists.
- No weapon-class filter, no enemy-movement layer, no facing — those are later
  Bucket C pieces.
- Chip is map/side/season-scoped, not zoom-scoped.
- Filter is binary (All vs Openers), not a multi-state segmented control.
