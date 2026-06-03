# Bucket C — Piece 1: Single-Duel Focus (+ data layer) — Design

**Date:** 2026-06-03
**Status:** Approved (pending spec review)
**Goal:** Capture the cheap "Bucket C" per-duel fields in one recapture, and ship the first feature that uses them: a single-duel **focus** interaction on FragsMap where hovering a duel shows the engagement (slim animated tracer toward the loser + the enemy's position, other duels dimmed) and clicking it isolates the fight and opens an out-of-the-way detail dialog.

This is **Piece 1** of a planned series (later pieces, separate efforts: weapon-class filter; opening-duel/first-blood markers + stat; eventually a full enemy-position layer). The data layer here captures the full _cheap_ field set up front so those later pieces are pure UI — no second recapture.

---

## 1. Problem / context

Today each duel stores only `{ x, y (victim death loc), won, side, round }` (`lib/types.ts` `Duel`; built in `lib/transform.ts` `normalizeDetail`). The HenrikDev v4 match payload we already fetch (`henrik.matchById`, `/v4/match`) carries much more per kill — `player_locations` (every player's x/y + `view_radians` at kill time), `weapon`, `assistants`, and `time_in_round_in_ms` — all discarded. A `recapture.ts` script already re-fetches every stored match and re-runs `normalizeDetail`, so backfilling richer fields is a solved mechanism. We want to start mining that data, beginning with the most compelling view: seeing an individual gunfight on the map.

---

## 2. Scope

**In (this effort):**

- **Data layer:** extend `Duel` with the cheap Bucket C fields and populate them in `normalizeDetail`; transform the enemy position in `placeDuels`; recapture + regenerate the snapshot. Captured once now: enemy position, weapon, both agents, opener flag.
- **Piece 1 UI:** the single-duel hover + click-focus interaction on the drill-in duel dots, with the **marching-dash** tracer (option C) and the detail dialog.

**Out (separate later pieces / efforts):** the weapon-class **filter**; the **opening-duel** markers + win-rate stat (the `opener` field is _captured_ now but not yet surfaced); the full **all-10 `player_locations`** enemy-movement layer; facing/`view_radians` (the tracer is derived from the two positions, so facing is not needed). No schema migration (the `detail` column is already `jsonb`).

---

## 3. Data layer

### 3.1 `Duel` type (`lib/types.ts`)

Add optional fields (optional so pre-recapture/legacy rows and the fallback degrade gracefully):

```ts
export interface Duel {
  x: number; // victim death-location world coord (unchanged)
  y: number;
  won: boolean;
  side: "attack" | "defense";
  round: number;
  // Bucket C (optional; absent on un-recaptured matches)
  mx?: number; // MY world position at kill time
  my?: number;
  ex?: number; // ENEMY (the other duelist) world position at kill time
  ey?: number;
  weapon?: string; // weapon name for this duel (e.g. "Vandal")
  agent?: string; // my agent
  enemyAgent?: string; // the other duelist's agent
  opener?: boolean; // true if this was the round's first kill (first-blood)
}
```

`x,y` stays the death location (keeps the existing heatmap unchanged). `mx,my`/`ex,ey` are the two duelists' positions for the tracer + enemy marker.

### 3.2 `normalizeDetail` (`lib/transform.ts`)

For each kill where I killed or died (existing loop):

- **Positions:** from `k.player_locations` (array of `{ player_puuid|puuid, location:{x,y}, view_radians }`), pick my entry and the other duelist's entry. The victim's position is also `k.location` as a fallback. `mx,my` = my location; `ex,ey` = the enemy duelist's location. If `player_locations` is missing/!found, leave them undefined (dot still renders; no tracer/enemy).
- **Weapon:** `k.weapon?.name` for _every_ duel (not just my kills).
- **Agents:** build a `puuid → character.name` map from `detail.players` once; set `agent` (me) and `enemyAgent` (killer if I'm victim, victim if I'm killer).
- **Opener:** per round, the kill with the smallest `time_in_round_in_ms` is the round's first; flag its duel `opener: true`. (Compute a per-round "first kill id" set first, then flag.)

The `weapons` summary array is unchanged.

### 3.3 Placement (`lib/fightmap.ts` `placeDuels` + `Placed`)

Extend `Placed` with the normalized enemy position and the passthrough metadata used by the UI:

```ts
export interface Placed {
  nx: number;
  ny: number;
  won: boolean;
  side: "attack" | "defense";
  col: number;
  row: number;
  mnx?: number;
  mny?: number; // MY position, normalized
  enx?: number;
  eny?: number; // ENEMY position, normalized (same calibration)
  weapon?: string;
  agent?: string;
  enemyAgent?: string;
  round?: number;
  opener?: boolean;
}
```

In `placeDuels`, when the positions are present, normalize **both** duelist positions through the same calibration: `{ nx: mnx, ny: mny } = transformCoord(calib, { x: d.mx, y: d.my })` and `{ nx: enx, ny: eny } = transformCoord(calib, { x: d.ex, y: d.ey })`. Pass `weapon/agent/enemyAgent/round/opener` straight through. The base heatmap dot stays at `nx,ny` (the death location — unchanged). The focus overlay (§4) uses `mnx,mny` (you) and `enx,eny` (enemy) as the two endpoints, and the existing `won` flag tells us which endpoint is the loser (for tracer direction) — no separate death-location math needed.

### 3.4 Recapture + snapshot

- Re-run `scripts/recapture.ts` (unchanged in shape — it calls `normalizeDetail`) to rewrite every match's `detail` in Neon, then regenerate `data/snapshot.json` via the existing snapshot/bootstrap path.
- **Size:** adds ~4 numbers + 3 short strings + 1 bool per duel. The committed snapshot (~783 KB today) is expected to land roughly ~1.2–1.5 MB — acceptable for the git-committed fallback. (If it overshoots materially, the fallback can omit `mx,my/ex,ey` and keep them DB-only; not expected to be necessary.)

### 3.5 Feasibility spike (first implementation task)

Before building on it: fetch one real match via `henrik.matchById` and confirm the `kills[].player_locations` shape (field names: `player_puuid` vs `puuid`, `location.{x,y}`, presence of `view_radians`) and `time_in_round_in_ms`. Adjust §3.2 field access to match. This de-risks the whole effort.

---

## 4. Piece 1 UI — single-duel focus

The duel dots render in the drill-in detail over the map (`components/fightmap/RegionDetail.tsx` for polygon/Regions, `components/fightmap/ZoneDetail.tsx` for Grid) — both draw `<circle fill={p.won ? green : red}>` per `Placed`. The focus interaction lives there (extract a shared `DuelDots`/overlay so both views get it without duplication).

**States:**

- **Idle:** dots as today (kill = `#5fd07a`, death = `#e35d6a`).
- **Hover a dot:** all _other_ dots dim (opacity ~0.18); the hovered duel shows (a) the two endpoints — a **you** marker (filled dot) at `mnx,mny` and an **enemy** marker (hollow orange crosshair ring `#ff8e5e`) at `enx,eny`; and (b) a **slim marching-dash tracer** between them — a thin dashed line whose `stroke-dashoffset` animates so dashes flow **toward the loser** (see Tracer direction). No dialog yet. If the duel lacks the positions, hover just highlights the dot (graceful).
- **Click a dot (focus):** all other dots are **removed** (not just dimmed). A **detail dialog** pins to the map corner **opposite** the engagement's centroid (so it never covers the action). The dialog **always** shows what every duel has — outcome chip (KILL/DEATH), round + side; the **weapon**, **distance** (from the two normalized points), and the two **agents** (you / enemy) rows appear only when those fields exist. The you/enemy markers + tracer render only when the positions exist (so on un-recaptured data you still get a dialog, just no tracer). The dialog has an **✕**. **Unfocus** via: ✕, clicking empty map, or clicking the focused dot again. Focus is single-select (clicking another dot moves focus).

**Tracer direction:** dashes flow from the survivor (shooter) toward the player who died. The `won` flag decides it directly: when I **won**, dashes flow toward the **enemy** (`enx,eny`); when I **died**, toward **me** (`mnx,mny`). No death-location lookup needed.

**Motion / accessibility:** CSS/SVG-only animation (no JS rAF), per the project's CSS-first preference. `prefers-reduced-motion: reduce` → render the tracer as a static slim line (no dash animation). Tracer loops continuously while hovered/focused.

**State:** a `focused: number | null` and `hovered: number | null` in the detail component (indexes into the placed-duel array). Pointer/keyboard parity: Esc unfocuses.

---

## 5. Edge cases

- **Un-recaptured / legacy duel** (no positions): the dot renders as today; hover highlights only (no tracer/markers). Clicking still opens the dialog with the always-present outcome/round/side (and weapon/agents if those exist) — just no tracer/markers. So the feature degrades to a plain detail popup rather than breaking.
- **Snapshot fallback** lacking the fields: same graceful path — the app works exactly as today.
- **Enemy position maps outside the minimap** (rare bad coord): the ring clamps to the map edge like other coords; tracer still drawn.
- **Self-kill / no enemy in `player_locations`:** no enemy ring/tracer; dialog shows what's available.
- **Reduced motion:** static line, everything else identical.
- **Distance:** if positions are missing, omit the distance row.

---

## 6. Testing

**Unit (vitest):**

- `normalizeDetail` (`tests/transform.test.ts` or existing): given a synthetic v4 detail with `player_locations`, `weapon`, `players`, and two kills in a round → duels carry correct `mx,my/ex,ey/weapon/agent/enemyAgent`, and only the earliest-`time_in_round_in_ms` kill per round has `opener: true`. Legacy detail without `player_locations` → fields undefined, no throw.
- `placeDuels`: a duel with `mx,my`/`ex,ey` → `mnx,mny`/`enx,eny` present and equal to `transformCoord` of those coords; passthrough fields copied; duel without them → `mnx,mny`/`enx,eny` undefined.

**Smoke (Playwright, `tests/smoke.spec.ts`):**

- Drill into a zone on a traced map (existing `gotoRegions` helper path), click a duel dot → the detail dialog appears (assert outcome/weapon text or a `role="dialog"`), and the ✕ closes it. (Tracer animation itself isn't asserted; the dialog + focus behavior is.)

**Manual:** recapture locally, open FragsMap → Regions → a zone; hover dots (tracer + enemy + dim), click one (others vanish, dialog out of the way), close 3 ways; verify reduced-motion static line.

---

## 7. Scope guard (YAGNI)

**In:** `Duel`/`Placed` field additions; `normalizeDetail` extraction (positions/weapon/agents/opener); `placeDuels` enemy transform + passthrough; recapture + snapshot regen; the shared duel-dots focus overlay (marching-dash tracer C, enemy ring, dim/hide, corner dialog, reduced-motion fallback) used by RegionDetail + ZoneDetail; the tests above.

**Out:** the weapon-class filter UI; opening-duel markers/stat (field captured, not surfaced); all-10 `player_locations` movement layer; `view_radians` facing; any DB schema migration; changing the heatmap shading or the Grid/Regions tally; multi-duel selection/compare.
