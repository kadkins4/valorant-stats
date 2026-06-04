# FragsMap Accessibility — Design

**Date:** 2026-06-03
**Status:** Approved (pending spec review)
**Goal:** Make FragsMap fully operable and understandable without a mouse or color vision — keyboard navigation, screen-reader semantics, color-independent encoding, and a data-table alternative to the heatmap — targeting WCAG 2.1 AA for the FragsMap interactive surface.

---

## 1. Problem / context

FragsMap's interactive elements are pointer-only SVG with no keyboard or screen-reader (SR) support: `ZoneGrid` cells, `RegionView` regions, and `DuelMap` dots/badges/fan-handles all use `onClick` on SVG shapes with no `tabindex`, role, or accessible name. Win/loss (green/red dots) and zone win-rate (a red→gray→green scale) are conveyed by **color alone**. The duel detail popup is a plain `<div>` (no `role="dialog"`, no focus management). The filter controls `SideToggle`, `TimeSelector`, and the Grid·Regions view toggle lack pressed-state and rely on icons (`aria-hidden`). `MapPicker` already has `aria-pressed`.

A screen-reader user gets essentially nothing from the map; a keyboard-only user cannot select a zone, drill in, or open a duel; a colorblind user cannot read win/loss or win-rate.

---

## 2. Scope

**In:** keyboard operability + SR semantics + color-independent encoding + focus management for the FragsMap controls and the map's data, via the **"equivalent accessible control"** pattern — a breakdown table that _is_ the keyboard/SR interface — plus a drill-in duel list, dialog semantics, kill/death shape coding, per-zone win% text, control `aria-pressed`/labels, and a consistent visible focus ring. Target WCAG 2.1 AA for these interactions.

**Out (separate efforts):** a11y of Home / Nav / Charts pages; a full automated axe audit gating the whole app; any change to the heatmap math, tallies, or underlying data; new touch gestures; roving arrow-key navigation over raw SVG shapes (the table replaces the need); a sortable breakdown table.

**Phasing — two independently shippable plans:**

- **Phase 1 — Foundations:** kill/death **shape coding** (circle / ✕) + per-zone **win% text**; **controls** (`aria-pressed` + accessible names on `SideToggle`/`TimeSelector`/view toggle/`MapPicker`); **dialog** semantics (`role="dialog"` + focus management); global **`:focus-visible`** ring. Each item is self-contained and shippable.
- **Phase 2 — Accessible data layer:** the **breakdown table-as-control** + two-way selection sync; the **drill-in duel list**; marking the decorative SVG `aria-hidden` so the table carries the semantics.

This spec covers the whole design; the implementation plan(s) follow the phases.

---

## 3. The accessible-control pattern

The visual SVG heatmap stays the pointer/visual layer (behavior unchanged). A parallel keyboard-and-SR layer provides equivalent functionality.

### 3.1 Breakdown table (the zone/region selector)

- A **visible, collapsible** `<table>` rendered below the map: "Zone breakdown" (Grid view) / "Region breakdown" (Regions view). Always present in the DOM (so SR users discover it) with a `<caption>`. A disclosure `<button>` ("Hide/Show breakdown", `aria-expanded`) toggles visibility; **default expanded**.
- **Columns** (`<th scope="col">`): Zone, Duels, Win %, Result.
- **Rows:** only zones/regions with ≥1 duel, in **spatial reading order** — Grid: row-major (top row left→right, then down); Regions: by centroid (top→bottom, then left→right).
- **Row name:** Regions view → the region/callout name. Grid view → a **derived dominant-callout name** (the callout nearest the cell center), so cells read "Mid", "A Site", "Heaven" rather than "Row 3, Col 2".
- **Selection control:** the first cell of each row is a `<button>` whose accessible name is the full sentence, e.g. _"Mid, 24 duels, 58% win rate, mostly win"_. Activating it (click or Enter/Space) **selects** that zone: sets the shared selection state, highlights the shape on the map, and opens the drill-in — identical to clicking the shape.
- **Two-way selection sync:** the single source of truth is the existing `selected` / `selectedRegion` state in `FightMap`. Selecting a shape marks the matching row (`aria-current="true"` and a visible highlight); selecting a row highlights the shape. (Optionally scroll the current row into view; not required.)
- **Result text** uses the **same plain-language wording as `Legend`** — "Mostly win" / "Even" / "Mostly lose", plus "Low sample" below `MIN_DUELS` (= 4). The visual heatmap is a _continuous_ gradient (no discrete bands), so the table introduces a small `resultBand(winRate, lowSample)` helper purely for the text column; use even = `0.45–0.55` (centered on the legend's "Even = 50%"), `< 0.45` → "Mostly lose", `> 0.55` → "Mostly win". The thresholds live in one helper so the wording stays consistent and tunable.

### 3.2 Drill-in duel list

- When a zone is selected, render — alongside the existing `DuelMap` — a `DuelList`: a list (`<ul>`/small `<table>`) of that zone's duels. Each item is a `<button>` named _"Kill · Vandal · round 7"_ / _"Death · Operator · round 3"_ (+ agents when present). Activating it **opens that duel's detail dialog** — the same outcome as clicking the dot — so dots/badges/fan-handles are reachable without keyboarding the SVG.
- **Order:** by round ascending, then outcome — stable and predictable.

### 3.3 Detail dialog

- `DuelMap`'s popup becomes `role="dialog"` `aria-modal="true"`, labelled by the outcome chip (KILL/DEATH) via `aria-labelledby`. On open, **move focus** into the dialog (the close button). On close (Esc — already wired — or ✕ / empty-map / re-click / list re-activation), **return focus** to the element that opened it (the `DuelList` button or, for pointer users, leave as-is). A simple **focus trap** keeps Tab within the dialog while open.

---

## 4. Color independence (SC 1.4.1)

- **Duel dots:** kill = filled **circle** (unchanged); death = **✕** (two crossed strokes), with green/red retained as a _redundant_ cue. Applies to `DuelMap` drill-in dots **and** fanned cluster handles. The engagement overlay markers (you = filled circle, enemy = hollow ring) and the gold cluster **badge** are unchanged (the badge is a mixed-cluster count, not a single outcome). Shape must remain legible at the dot's true size (validated via grayscale mockup → ✕ chosen).
- **Zone/region magnitude:** render the **win% as a small text label** on each zone (Grid cells, raster regions) / region (polygons), so magnitude is not color-only. Low-sample zones (below `MIN_DUELS`) render muted (e.g. the % in a muted color or omitted) consistent with the legend's "low sample" swatch. `Legend` already provides plain-language bands.
- Ensure the dot strokes and the win% labels meet contrast against the half-opacity minimap.

---

## 5. Controls accessibility

- **`SideToggle`:** each option a real toggle `<button>` with `aria-pressed` reflecting state and an accessible name ("Attack" / "Defense" / "Both"); decorative icons stay `aria-hidden`. Group labelled "Side".
- **`TimeSelector`:** season chips become toggle `<button>`s with `aria-pressed`; group labelled "Seasons".
- **View toggle (Grid / Regions):** `aria-pressed` on each button; the pair grouped and labelled "View".
- **`MapPicker`:** already `aria-pressed`; ensure each tile has an accessible name (the map name) via visible text or `aria-label`.
- **Global:** a consistent visible **`:focus-visible`** outline on all interactive elements (filter buttons, table row buttons, duel-list buttons, dialog close). Existing `prefers-reduced-motion` handling preserved.

---

## 6. Components / files

- **Create `lib/fightmap/breakdown.ts`** (pure, tested): `buildBreakdown(...)` → `BreakdownRow[]` (`{ key, name, duels, winRate, result, lowSample }`) from the view's zones/regions + transformed callouts; handles ordering (grid row-major / region centroid), dominant-callout naming for grid, result bands, low-sample flag, and the ≥1-duel filter. A `resultBand(winRate, lowSample)` helper shared with `Legend` if practical.
- **Create `components/fightmap/BreakdownTable.tsx`:** renders the collapsible table from rows; props `{ rows, selectedKey, onSelect, label }`; disclosure button; `aria-current` on the selected row.
- **Create `components/fightmap/DuelList.tsx`:** renders the drill-in duel buttons; props `{ points, onOpen }` (or an index callback); item accessible names from `Placed` fields.
- **Modify `FightMap.tsx`:** render `BreakdownTable` wired to the existing `selected`/`selectedRegion` state (both directions); render `DuelList` next to the drill-in; add `aria-pressed`/labels to the view toggle.
- **Modify `DuelMap.tsx`:** death dots render as ✕ (drill-in + fanned handles); dialog gets `role="dialog"`/`aria-modal`/labelledby + focus-in/return + trap; expose a way for `DuelList` to open a given duel (lift the "open duel i" trigger to a prop/callback or shared state).
- **Modify `ZoneGrid.tsx` / `RegionView.tsx`:** per-zone win% text labels; mark the decorative SVG `aria-hidden="true"` (or `role="img"` with a short summary) so SR relies on the table, not hundreds of shapes.
- **Modify `SideToggle.tsx`, `TimeSelector.tsx`, `MapPicker.tsx`:** `aria-pressed` + accessible names per §5.
- **Global CSS** (`app/globals.css` or equivalent): the `:focus-visible` ring.

Keep each new file single-responsibility; `buildBreakdown` is pure so the table/list components stay thin.

---

## 7. Edge cases

- **No duels / no calibration:** the table shows an empty state ("No duels for this filter"); no crash.
- **Low-sample zones:** shown muted in the table ("low sample") but still selectable.
- **Position-less duels** (~half the data): the drill-in `DuelList` still lists them; opening one shows the dialog without a tracer (existing graceful degradation).
- **Selection sync when filters change:** existing reset clears selection; the table reflects the new view.
- **Decorative SVG hidden from SR:** the table is the SR source of truth; the map is `aria-hidden`.
- **Reduced motion:** preserved.

---

## 8. Testing

**Unit (vitest):** `buildBreakdown` — ordering (grid row-major; region centroid order), dominant-callout naming for grid cells, result bands ("Mostly win"/"Even"/"Mostly lose"/"Low sample"), low-sample flag, and the ≥1-duel filter; `resultBand` mapping.

**Smoke / a11y (Playwright):**

- Tab reaches the breakdown table; a row `<button>` has the expected accessible name (`/, \d+ duels, \d+% win rate, (Mostly win|Even|Mostly lose|Low sample)/i`).
- Activating a row selects the zone → the drill-in appears (and the shape is marked selected).
- A `DuelList` button opens the dialog; the dialog has `role="dialog"`; focus is inside it; Esc closes and returns focus.
- `SideToggle` / `TimeSelector` / view toggle expose `aria-pressed`.
- (Optional) integrate `@axe-core/playwright` for an automated scan of `/fragsmap` asserting no serious/critical violations — only if we add the dev dependency; otherwise rely on the role/name/keyboard assertions above.

**Manual:** keyboard-only walkthrough (Tab/Enter/Esc), a VoiceOver pass over the table + dialog, and a grayscale check confirming circle/✕ disambiguates without color.

---

## 9. Scope guard (YAGNI)

**In:** the breakdown table-as-control + selection sync; the drill-in duel list; dialog semantics; kill/death ✕ shape coding; per-zone win% text; control `aria-pressed`/labels; the global focus ring; `buildBreakdown` + tests. Built as Phase 1 (foundations) then Phase 2 (data layer).

**Out:** Home/Nav/Charts a11y; arrow-key roving over raw SVG shapes; a sortable table; app-wide axe gating; any data/heatmap-math change.
