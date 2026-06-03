# Bucket C — Piece 1: Single-Duel Focus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture the cheap Bucket C per-duel fields (both duelists' positions, weapon, agents, first-blood) and ship the single-duel focus interaction on FragsMap: hover shows the engagement (marching-dash tracer toward the loser + you/enemy markers, others dim), click isolates it and opens an out-of-the-way detail dialog.

**Architecture:** Extend the `Duel` data shape + `normalizeDetail` parser (defensive against HenrikDev v4 field-name variants), normalize both duelist positions in `placeDuels` (new `Placed` fields + a `dist`), and extract a shared `DuelMap` component (used by `RegionDetail` + `ZoneDetail`) that owns the dots, the focus/hover overlay (CSS-animated tracer), and the corner dialog. Pure logic is TDD'd against a synthetic v4 payload; recapture + snapshot regen are operator steps run with credentials.

**Tech Stack:** Next.js 16 + React 19 + TS, Vitest (`@/` alias), Playwright smoke, pnpm.

**Spec:** `docs/superpowers/specs/2026-06-03-bucket-c-duel-focus-design.md`

---

## File Structure

- **Modify** `lib/types.ts` — add optional Bucket C fields to `Duel`.
- **Modify** `lib/transform.ts` — `normalizeDetail` extracts positions/weapon/agents/opener.
- **Modify** `lib/fightmap.ts` — `Placed` gains normalized positions + `dist`; `placeDuels` populates them; `WORLD_PER_METER` constant.
- **Create** `components/fightmap/DuelMap.tsx` + `DuelMap.module.css` — shared dots + focus overlay + dialog.
- **Modify** `components/fightmap/RegionDetail.tsx`, `components/fightmap/ZoneDetail.tsx` — render via `DuelMap`.
- **Create/Modify** `tests/transform.test.ts` (unit), `tests/fightmap.test.ts` (placeDuels), `tests/smoke.spec.ts` (dialog).
- **Operator (run with creds, not a code task):** feasibility spike, `scripts/recapture.ts`, snapshot regen, commit `data/snapshot.json`.

Work happens on the `bucket-c-duel-focus` branch (already checked out; spec committed).

---

## Task 1: `Duel` fields + `normalizeDetail` extraction

**Files:**

- Modify: `lib/types.ts`, `lib/transform.ts`
- Test: `tests/transform.test.ts`

- [ ] **Step 1: Add the optional fields to `Duel`** (`lib/types.ts`)

Append inside the `Duel` interface (after `round: number;`):

```ts
  // Bucket C (optional; absent on un-recaptured matches)
  mx?: number; // my world position at kill time
  my?: number;
  ex?: number; // enemy duelist world position at kill time
  ey?: number;
  weapon?: string;
  agent?: string;
  enemyAgent?: string;
  opener?: boolean; // round's first kill (first-blood)
```

- [ ] **Step 2: Write the failing test** (`tests/transform.test.ts`)

Create the file (if it exists, add these cases):

```ts
import { describe, it, expect } from "vitest";
import { normalizeDetail } from "@/lib/transform";

// Minimal synthetic v4-shaped detail: I am "me". Round 0 has two kills;
// my kill is earliest (opener). Round 1 has one kill where I die.
const ME = "me";
const detail = {
  players: [
    { puuid: "me", team_id: "Red", agent: { name: "Jett" } },
    { puuid: "foe", team_id: "Blue", agent: { name: "Reyna" } },
    { puuid: "ally", team_id: "Red", agent: { name: "Omen" } },
  ],
  rounds: [{ id: 0, plant: { player: { team: "Red" } } }, { id: 1 }],
  kills: [
    {
      round: 0,
      time_in_round_in_ms: 8000,
      killer: { puuid: "ally" },
      victim: { puuid: "foe2" },
      location: { x: 1, y: 1 },
      weapon: { name: "Spectre" },
      player_locations: [],
    },
    {
      round: 0,
      time_in_round_in_ms: 3000,
      killer: { puuid: "me" },
      victim: { puuid: "foe" },
      location: { x: 500, y: 600 }, // foe death loc
      weapon: { name: "Vandal" },
      player_locations: [
        { player_puuid: "me", location: { x: 100, y: 120 } },
        { player_puuid: "foe", location: { x: 500, y: 600 } },
      ],
    },
    {
      round: 1,
      time_in_round_in_ms: 5000,
      killer: { puuid: "foe" },
      victim: { puuid: "me" },
      location: { x: 900, y: 950 }, // my death loc
      weapon: { name: "Operator" },
      player_locations: [
        { player_puuid: "me", location: { x: 900, y: 950 } },
        { player_puuid: "foe", location: { x: 300, y: 200 } },
      ],
    },
  ],
};

describe("normalizeDetail Bucket C", () => {
  const { duels } = normalizeDetail(detail, ME);

  it("captures only my kills/deaths", () => {
    expect(duels).toHaveLength(2); // round0 my kill + round1 my death
  });

  it("captures my kill with positions, weapon, agents, opener", () => {
    const k = duels.find((d) => d.won)!;
    expect(k).toMatchObject({
      won: true,
      weapon: "Vandal",
      agent: "Jett",
      enemyAgent: "Reyna",
      mx: 100,
      my: 120,
      ex: 500,
      ey: 600,
      opener: true, // earliest time_in_round_in_ms in round 0
    });
  });

  it("captures my death: I am at the death location, enemy elsewhere", () => {
    const d = duels.find((x) => !x.won)!;
    expect(d).toMatchObject({
      won: false,
      weapon: "Operator",
      enemyAgent: "Reyna",
      mx: 900,
      my: 950,
      ex: 300,
      ey: 200,
    });
  });

  it("degrades when player_locations is missing", () => {
    const legacy = {
      ...detail,
      kills: [
        {
          round: 0,
          killer: { puuid: "me" },
          victim: { puuid: "foe" },
          location: { x: 5, y: 6 },
          weapon: { name: "Sheriff" },
        },
      ],
    };
    const { duels: ld } = normalizeDetail(legacy, ME);
    expect(ld[0].mx).toBeUndefined();
    expect(ld[0].ex).toBeUndefined();
    expect(ld[0].weapon).toBe("Sheriff");
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm exec vitest run tests/transform.test.ts`
Expected: FAIL (fields not populated).

- [ ] **Step 4: Implement** (`lib/transform.ts`)

Replace the body of `normalizeDetail` with:

```ts
export function normalizeDetail(detail: any, puuid: string): NormalizedDetail {
  const players = detail.players ?? [];
  const myTeam: Team | undefined = players.find(
    (p: any) => p.puuid === puuid,
  )?.team_id;
  const agentOf = (pid?: string): string | undefined => {
    const p = players.find((x: any) => x.puuid === pid);
    return p?.agent?.name ?? p?.character?.name ?? p?.character ?? undefined;
  };
  const attackBy = attackingTeamByRound(detail.rounds ?? []);
  const kills = detail.kills ?? [];

  // Round's first kill (smallest time_in_round_in_ms) = first-blood.
  const firstKillOfRound = new Map<number, any>();
  for (const k of kills) {
    const cur = firstKillOfRound.get(k.round);
    const t = k.time_in_round_in_ms ?? Infinity;
    if (!cur || t < (cur.time_in_round_in_ms ?? Infinity))
      firstKillOfRound.set(k.round, k);
  }

  const counts = new Map<string, number>();
  const duels: Duel[] = [];

  for (const k of kills) {
    const iKilled = k.killer?.puuid === puuid;
    const iDied = k.victim?.puuid === puuid;
    if (iKilled) {
      const w = k.weapon?.name ?? "Unknown";
      counts.set(w, (counts.get(w) ?? 0) + 1);
    }
    if ((iKilled || iDied) && k.location) {
      const att = attackBy[k.round];
      const side: "attack" | "defense" =
        myTeam && att ? (att === myTeam ? "attack" : "defense") : "attack";
      const enemyPuuid = iKilled ? k.victim?.puuid : k.killer?.puuid;

      const locs = k.player_locations ?? [];
      const locOf = (pid?: string) =>
        locs.find((l: any) => (l.player_puuid ?? l.puuid) === pid)?.location;
      // The victim's death location is k.location; the other duelist comes from
      // player_locations.
      const myLoc = iDied ? k.location : locOf(puuid);
      const enemyLoc = iKilled ? k.location : locOf(enemyPuuid);

      const duel: Duel = {
        x: k.location.x,
        y: k.location.y,
        won: iKilled,
        side,
        round: k.round,
      };
      if (myLoc) {
        duel.mx = myLoc.x;
        duel.my = myLoc.y;
      }
      if (enemyLoc) {
        duel.ex = enemyLoc.x;
        duel.ey = enemyLoc.y;
      }
      if (k.weapon?.name) duel.weapon = k.weapon.name;
      const myAgent = agentOf(puuid);
      if (myAgent) duel.agent = myAgent;
      const ea = agentOf(enemyPuuid);
      if (ea) duel.enemyAgent = ea;
      if (firstKillOfRound.get(k.round) === k) duel.opener = true;
      duels.push(duel);
    }
  }

  const weapons = [...counts.entries()]
    .map(([weapon, kills]) => ({ weapon, kills }))
    .sort((a, b) => b.kills - a.kills);

  return { weapons, duels };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm exec vitest run tests/transform.test.ts` → PASS. Then `pnpm exec tsc --noEmit` → clean.

- [ ] **Step 6: Commit**

```bash
git add lib/types.ts lib/transform.ts tests/transform.test.ts
git commit -m "Capture Bucket C duel fields in normalizeDetail"
```

---

## Task 2: `Placed` fields + `placeDuels`

**Files:**

- Modify: `lib/fightmap.ts`
- Test: `tests/fightmap.test.ts`

- [ ] **Step 1: Add fields + constant** (`lib/fightmap.ts`)

Add to the `Placed` interface (after `row: number;`):

```ts
  mnx?: number;
  mny?: number; // my position, normalized
  enx?: number;
  eny?: number; // enemy position, normalized
  dist?: number; // approx meters between duelists
  weapon?: string;
  agent?: string;
  enemyAgent?: string;
  round?: number;
  opener?: boolean;
```

Add near the top exports (by `GRID_N`):

```ts
// Approximate Valorant world-units per meter. Tune during the feasibility spike
// so close/long-range duels read sensibly; only used for the dialog's distance.
export const WORLD_PER_METER = 100;
```

- [ ] **Step 2: Write the failing test** (`tests/fightmap.test.ts`)

Add:

```ts
import { placeDuels } from "@/lib/fightmap";
import type { Duel } from "@/lib/types";

// transformCoord is identity-ish under a calibration that maps world→[0,1];
// build a calibration that the existing tests already use, or a trivial one.
// (Reuse the calibration helper/import already present in this test file.)

describe("placeDuels Bucket C passthrough", () => {
  const calib = TEST_CALIB; // existing calibration fixture in this file
  it("normalizes both positions and passes metadata through", () => {
    const d: Duel = {
      x: 0,
      y: 0,
      won: true,
      side: "attack",
      round: 3,
      mx: 0,
      my: 0,
      ex: 0,
      ey: 0,
      weapon: "Vandal",
      agent: "Jett",
      enemyAgent: "Reyna",
      opener: true,
    };
    const [p] = placeDuels([d], calib);
    expect(p.mnx).toBeTypeOf("number");
    expect(p.enx).toBeTypeOf("number");
    expect(p.dist).toBe(0);
    expect(p).toMatchObject({
      weapon: "Vandal",
      agent: "Jett",
      enemyAgent: "Reyna",
      round: 3,
      opener: true,
    });
  });
  it("leaves positions undefined when absent", () => {
    const d: Duel = { x: 0, y: 0, won: false, side: "defense", round: 1 };
    const [p] = placeDuels([d], calib);
    expect(p.mnx).toBeUndefined();
    expect(p.enx).toBeUndefined();
    expect(p.dist).toBeUndefined();
  });
});
```

Note: reuse whatever calibration fixture `tests/fightmap.test.ts` already constructs for its existing `placeDuels`/`transformCoord` cases (search the file for the calibration it passes today and use the same one as `TEST_CALIB`). If there is none, import `getCalibration("Ascent")` from `@/lib/maps/calibration`.

- [ ] **Step 3: Run to verify it fails**

Run: `pnpm exec vitest run tests/fightmap.test.ts` → FAIL.

- [ ] **Step 4: Implement** (`lib/fightmap.ts` `placeDuels`)

Replace the `.map` body:

```ts
export function placeDuels(
  duels: Duel[],
  calib: MapCalibration,
  gridN = GRID_N,
): Placed[] {
  return duels.map((d) => {
    const { nx, ny } = transformCoord(calib, d);
    const placed: Placed = {
      nx,
      ny,
      won: d.won,
      side: d.side,
      col: clampCell(nx, gridN),
      row: clampCell(ny, gridN),
      weapon: d.weapon,
      agent: d.agent,
      enemyAgent: d.enemyAgent,
      round: d.round,
      opener: d.opener,
    };
    if (d.mx != null && d.my != null) {
      const m = transformCoord(calib, { x: d.mx, y: d.my });
      placed.mnx = m.nx;
      placed.mny = m.ny;
    }
    if (d.ex != null && d.ey != null) {
      const e = transformCoord(calib, { x: d.ex, y: d.ey });
      placed.enx = e.nx;
      placed.eny = e.ny;
    }
    if (d.mx != null && d.ex != null && d.my != null && d.ey != null) {
      placed.dist = Math.round(
        Math.hypot(d.mx - d.ex, d.my - d.ey) / WORLD_PER_METER,
      );
    }
    return placed;
  });
}
```

Confirm `transformCoord` accepts `{ x, y }` (it is called with a `Duel` today, which has `x,y` — a bare `{x,y}` satisfies the same shape). If its type is stricter, pass `{ ...d, x: d.mx, y: d.my }`.

- [ ] **Step 5: Run to verify it passes** + `pnpm exec tsc --noEmit`.

- [ ] **Step 6: Commit**

```bash
git add lib/fightmap.ts tests/fightmap.test.ts
git commit -m "Normalize both duelist positions in placeDuels"
```

---

## Task 3: `DuelMap` shared component + dialog + tracer

**Files:**

- Create: `components/fightmap/DuelMap.tsx`, `components/fightmap/DuelMap.module.css`
- Modify: `components/fightmap/RegionDetail.tsx`, `components/fightmap/ZoneDetail.tsx`

- [ ] **Step 1: Create `DuelMap.module.css`**

```css
.wrap {
  position: relative;
}
.svg {
  display: block;
  border-radius: 10px;
  border: 1px solid #222a38;
  aspect-ratio: 1 / 1;
}
.tracer {
  stroke-dasharray: 2 2.4;
  stroke-linecap: round;
  animation: march 0.55s linear infinite;
}
@keyframes march {
  from {
    stroke-dashoffset: 4.4;
  }
  to {
    stroke-dashoffset: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .tracer {
    animation: none;
    stroke-dasharray: none;
  }
}
.dialog {
  position: absolute;
  width: 196px;
  background: #161b26;
  border: 1px solid #2c3447;
  border-radius: 11px;
  padding: 12px 13px;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6);
  font-size: 12.5px;
}
.close {
  position: absolute;
  top: 8px;
  right: 9px;
  width: 18px;
  height: 18px;
  border-radius: 5px;
  border: 1px solid #2c3447;
  color: #8b93a7;
  background: #11151d;
  cursor: pointer;
  font-size: 11px;
  line-height: 1;
}
.out {
  display: inline-block;
  font-size: 11px;
  font-weight: 800;
  padding: 2px 8px;
  border-radius: 6px;
  margin-bottom: 9px;
}
.out[data-win="true"] {
  background: rgba(95, 208, 122, 0.16);
  color: #7fe39a;
}
.out[data-win="false"] {
  background: rgba(227, 93, 106, 0.16);
  color: #f08a95;
}
.row {
  display: flex;
  justify-content: space-between;
  padding: 3px 0;
}
.rk {
  color: #8b93a7;
}
.sep {
  height: 1px;
  background: #222a38;
  margin: 8px 0;
}
```

- [ ] **Step 2: Create `DuelMap.tsx`**

```tsx
"use client";
import { useEffect, useState } from "react";
import type { Placed } from "@/lib/fightmap";
import styles from "./DuelMap.module.css";

const GREEN = "#5fd07a";
const RED = "#e35d6a";
const ENEMY = "#ff8e5e";
const GOLD = "#ffd166";

const hasPos = (p?: Placed) =>
  !!p && p.mnx != null && p.mny != null && p.enx != null && p.eny != null;

export default function DuelMap({
  image,
  points,
  overlay,
}: {
  image: string;
  points: Placed[];
  overlay?: React.ReactNode;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [focused, setFocused] = useState<number | null>(null);

  // Esc unfocuses.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFocused(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const active = focused ?? hovered;
  const fp = focused != null ? points[focused] : null;

  // Dialog pins to the corner opposite the engagement centroid.
  const ex = fp ? (hasPos(fp) ? (fp.mnx! + fp.enx!) / 2 : fp.nx) : 0.5;
  const ey = fp ? (hasPos(fp) ? (fp.mny! + fp.eny!) / 2 : fp.ny) : 0.5;
  const corner: React.CSSProperties = {
    [ex < 0.5 ? "right" : "left"]: 10,
    [ey < 0.5 ? "bottom" : "top"]: 10,
  };

  return (
    <div className={styles.wrap}>
      <svg
        viewBox="0 0 100 100"
        width="100%"
        className={styles.svg}
        onClick={() => setFocused(null)}
      >
        <image
          href={image}
          x="0"
          y="0"
          width="100"
          height="100"
          opacity="0.5"
          preserveAspectRatio="xMidYMid slice"
        />
        {overlay}
        {points.map((p, i) => {
          if (focused != null && i !== focused) return null;
          const dim = focused == null && hovered != null && hovered !== i;
          return (
            <circle
              key={i}
              cx={p.nx * 100}
              cy={p.ny * 100}
              r="1.6"
              fill={p.won ? GREEN : RED}
              stroke="#11151d"
              strokeWidth="0.3"
              opacity={dim ? 0.18 : 1}
              style={{ cursor: "pointer", transition: "opacity .12s" }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              onClick={(e) => {
                e.stopPropagation();
                setFocused((f) => (f === i ? null : i));
              }}
            />
          );
        })}
        {active != null && hasPos(points[active]) && (
          <Engagement p={points[active]} />
        )}
      </svg>
      {fp && (
        <div className={styles.dialog} style={corner}>
          <button
            className={styles.close}
            aria-label="Close"
            onClick={() => setFocused(null)}
          >
            ✕
          </button>
          <span className={styles.out} data-win={fp.won}>
            {fp.won ? "KILL" : "DEATH"}
          </span>
          <Row
            k="Round"
            v={`${fp.round ?? "—"} · ${fp.side === "attack" ? "⚔ Attack" : "🛡 Defense"}`}
          />
          {fp.weapon && <Row k="Weapon" v={fp.weapon} />}
          {fp.dist != null && <Row k="Distance" v={`${fp.dist} m`} />}
          {(fp.agent || fp.enemyAgent) && <div className={styles.sep} />}
          {fp.agent && <Row k="You" v={fp.agent} />}
          {fp.enemyAgent && <Row k="Enemy" v={fp.enemyAgent} />}
        </div>
      )}
    </div>
  );
}

function Engagement({ p }: { p: Placed }) {
  // Dashes flow from survivor toward the loser. won → loser is the enemy.
  const survivor = p.won ? [p.mnx!, p.mny!] : [p.enx!, p.eny!];
  const loser = p.won ? [p.enx!, p.eny!] : [p.mnx!, p.mny!];
  return (
    <g pointerEvents="none">
      <line
        x1={survivor[0] * 100}
        y1={survivor[1] * 100}
        x2={loser[0] * 100}
        y2={loser[1] * 100}
        stroke={GOLD}
        strokeWidth="0.6"
        className={styles.tracer}
      />
      <circle
        cx={p.mnx! * 100}
        cy={p.mny! * 100}
        r="1.6"
        fill={GREEN}
        stroke="#11151d"
        strokeWidth="0.3"
      />
      <circle
        cx={p.enx! * 100}
        cy={p.eny! * 100}
        r="2"
        fill="none"
        stroke={ENEMY}
        strokeWidth="0.9"
      />
    </g>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className={styles.row}>
      <span className={styles.rk}>{k}</span>
      <span>{v}</span>
    </div>
  );
}
```

- [ ] **Step 3: Refactor `ZoneDetail.tsx`**

Replace the `<svg>…</svg>` block with `DuelMap`, passing the zone rect as `overlay`:

```tsx
"use client";
import { GRID_N, type Placed } from "@/lib/fightmap";
import DuelMap from "./DuelMap";

export default function ZoneDetail({
  image,
  points,
  zone,
}: {
  image: string;
  points: Placed[];
  zone: { col: number; row: number };
}) {
  const inZone = points.filter((p) => p.col === zone.col && p.row === zone.row);
  const wins = inZone.filter((p) => p.won).length;
  return (
    <div style={{ maxWidth: 360 }}>
      <h3 style={{ margin: "4px 0" }}>
        {inZone.length} duels · {wins} won
      </h3>
      <DuelMap
        image={image}
        points={inZone}
        overlay={
          <rect
            x={(zone.col * 100) / GRID_N}
            y={(zone.row * 100) / GRID_N}
            width={100 / GRID_N}
            height={100 / GRID_N}
            fill="none"
            stroke="#fff"
            strokeWidth="0.5"
            opacity="0.6"
          />
        }
      />
    </div>
  );
}
```

- [ ] **Step 4: Refactor `RegionDetail.tsx`**

Replace its `<svg>…</svg>` dots block (the one rendering `<image>` + `points.map(circle)`) with:

```tsx
<DuelMap image={image} points={points} />
```

Add the import at the top: `import DuelMap from "./DuelMap";`. Leave the side-cells / header above it untouched. Remove the now-unused `<svg>`/`<image>`/`<circle>` markup it replaced.

- [ ] **Step 5: Typecheck, lint, build**

Run: `pnpm exec tsc --noEmit && pnpm exec eslint components/fightmap/DuelMap.tsx components/fightmap/ZoneDetail.tsx components/fightmap/RegionDetail.tsx`
Expected: clean.

Run: `pnpm build` → compiles.

- [ ] **Step 6: Manual check** (`pnpm dev`)

FragsMap → Regions → click a zone → hover dots (others dim; on recaptured data, tracer + markers). Click a dot → others vanish, dialog pins to the opposite corner; close via ✕ / empty-map click / re-click / Esc. (Pre-recapture, the dialog shows outcome/round/side only — expected.)

- [ ] **Step 7: Commit**

```bash
git add components/fightmap/DuelMap.tsx components/fightmap/DuelMap.module.css components/fightmap/ZoneDetail.tsx components/fightmap/RegionDetail.tsx
git commit -m "Add shared DuelMap with single-duel focus dialog and tracer"
```

---

## Task 4: Smoke test — focus dialog opens and closes

**Files:**

- Modify: `tests/smoke.spec.ts`

- [ ] **Step 1: Add the test** (uses the existing `gotoRegions` helper)

```ts
test("clicking a duel dot opens and closes the focus dialog", async ({
  page,
}) => {
  await gotoRegions(page);
  await page.waitForLoadState("networkidle");
  // Open a region's detail (its duel dots).
  await page.locator("svg polygon").first().dispatchEvent("click");
  // Click a duel dot. Dots are the small circles in the detail SVG.
  await page.locator("svg circle").last().dispatchEvent("click");
  // Dialog shows the always-present outcome.
  await expect(page.getByText(/^(KILL|DEATH)$/).first()).toBeVisible();
  // Close it.
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByText(/^(KILL|DEATH)$/)).toHaveCount(0);
});
```

- [ ] **Step 2: Run it**

Run: `pnpm exec playwright test -g "focus dialog"`
Expected: PASS. If the `svg circle` selector is ambiguous (matches a non-dot circle), scope it to the detail panel or filter by fill color; adjust until green.

- [ ] **Step 3: Run the full suites**

Run: `pnpm exec vitest run` and `pnpm exec playwright test` → all PASS.

- [ ] **Step 4: Commit**

```bash
git add tests/smoke.spec.ts
git commit -m "Smoke-test the duel focus dialog"
```

---

## Operator steps (run by Kendall, with credentials — NOT subagent tasks)

These need `.env` (`VAL_API_KEY`, `DATABASE_URL`) and live network; they are not part of automated execution. Do them after Tasks 1–4 land and pass.

1. **Feasibility spike — confirm the v4 kill shape.** Quick check that `kills[].player_locations` uses `player_puuid` + `location.{x,y}` and that `time_in_round_in_ms` exists. One-off:

   ```bash
   # from the repo root with .env present
   npx tsx -e "import {henrik} from './lib/henrik'; import {account} from './lib/config'; import {readSnapshot} from './lib/snapshot'; \
   const id=readSnapshot()!.matches[0].matchId; henrik.matchById(account.region,id).then(m=>{const k=(m.data.kills||[]).find((x:any)=>x.player_locations?.length); console.log(JSON.stringify({keys:Object.keys(k||{}),loc0:k?.player_locations?.[0]},null,2));});"
   ```

   If field names differ, adjust `locOf`/`agentOf` in `lib/transform.ts` (one-line changes) and re-run Task 1 tests. Also sanity-check `WORLD_PER_METER` against a known close/long duel and tune `lib/fightmap.ts`.

2. **Recapture** every match into Neon:

   ```bash
   npx tsx scripts/recapture.ts
   ```

3. **Regenerate the snapshot** (committed fallback) via the existing path:

   ```bash
   npx tsx scripts/bootstrap-snapshot.ts   # or the project's snapshot-write script
   ```

   Confirm `data/snapshot.json` grew modestly (expected ~1.3 MB, not multi-MB). If it ballooned, drop `mx/my/ex/ey` from the snapshot serialization (keep DB-only) and re-evaluate.

4. **Verify + commit the snapshot:** open FragsMap, confirm tracers/markers/weapon/agents now render on focus; then `git add data/snapshot.json && git commit -m "Recapture matches with Bucket C duel fields"`.

---

## Final verification

- [ ] `pnpm exec tsc --noEmit` — clean.
- [ ] `pnpm exec eslint .` — clean (or only pre-existing accepted warnings).
- [ ] `pnpm exec vitest run` — all unit tests pass (transform + fightmap + existing).
- [ ] `pnpm exec playwright test` — all smoke pass incl. the focus-dialog test.
- [ ] `pnpm build` — production build succeeds.
- [ ] Manual (post-recapture): full hover/focus cycle with tracer + dialog on a real map; reduced-motion shows a static line.

```

```
