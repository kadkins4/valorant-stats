# Opening-Duel Markers + Win-Rate Stat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface the already-captured `opener` flag on FragsMap as a gold ring marker, a headline + per-region win-rate stat, and an `All duels / Openers` filter.

**Architecture:** Filter opener duels at the single `collectDuels` chokepoint (mirrors the Side filter) so all downstream views stay index-consistent. Aggregate stats live in a new pure, unit-tested module (`lib/fightmap/openers.ts`); presentational pieces (ring, chip, column) are verified by build + Playwright smoke, consistent with the codebase's split (logic tested, SVG/JSX not).

**Tech Stack:** Next.js 16, TypeScript, React 19, Vitest (`pnpm test`), Playwright (`pnpm smoke`), tsc, ESLint.

**Data note:** No recapture, no new captured fields. `opener?: boolean` already rides `Duel` → `Placed`.

**Per-task gate** unless stated otherwise: `pnpm test` (green) + `npx tsc --noEmit` (clean). Commits omit the Co-Authored-By trailer (project convention).

---

### Task 1: `openersOnly` filter in `collectDuels`

**Files:**

- Modify: `lib/fightmap.ts` (`FilterOpts` interface + `collectDuels`)
- Test: `tests/fightmap.test.ts`

- [ ] **Step 1: Write the failing test**

Add inside the existing `describe("collectDuels", …)` block in `tests/fightmap.test.ts`. The shared `d()` factory takes `(won, side)`; extend the two opener cases with the `opener` field inline. Add this dataset + tests at the end of the describe block:

```ts
it("filters to opening duels when openersOnly is set", () => {
  const all: TimeScope = { kind: "all" };
  const op: FightMatch[] = [
    fm("o1", "Haven", "e10a3", "2026-05-01T00:00:00.000Z", [
      { x: 0, y: 0, won: true, side: "attack", round: 1, opener: true },
      { x: 0, y: 0, won: false, side: "attack", round: 1 },
      { x: 0, y: 0, won: false, side: "defense", round: 2, opener: true },
    ]),
  ];
  const out = collectDuels(op, {
    map: "Haven",
    side: "both",
    time: all,
    openersOnly: true,
  });
  expect(out).toHaveLength(2);
  expect(out.every((duD) => duD.opener)).toBe(true);
});

it("returns all duels when openersOnly is false/absent", () => {
  const all: TimeScope = { kind: "all" };
  const op: FightMatch[] = [
    fm("o2", "Haven", "e10a3", "2026-05-01T00:00:00.000Z", [
      { x: 0, y: 0, won: true, side: "attack", round: 1, opener: true },
      { x: 0, y: 0, won: false, side: "attack", round: 1 },
    ]),
  ];
  expect(
    collectDuels(op, { map: "Haven", side: "both", time: all }),
  ).toHaveLength(2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/fightmap.test.ts`
Expected: FAIL — `openersOnly` is not a known property of `FilterOpts` (tsc error) / opener filter not applied.

- [ ] **Step 3: Implement**

In `lib/fightmap.ts`, add the field to `FilterOpts`:

```ts
export interface FilterOpts {
  map: string;
  side: "attack" | "defense" | "both";
  time: TimeScope;
  openersOnly?: boolean;
}
```

In `collectDuels`, add the filter immediately after the side filter (just before `return duels;`):

```ts
if (o.side !== "both") duels = duels.filter((x) => x.side === o.side);
if (o.openersOnly) duels = duels.filter((x) => x.opener);
return duels;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/fightmap.test.ts`
Expected: PASS (all collectDuels tests, including the two new ones).

- [ ] **Step 5: Commit**

```bash
git add lib/fightmap.ts tests/fightmap.test.ts
git commit -m "Add openersOnly filter to collectDuels"
```

---

### Task 2: `openers.ts` — `openerStat` + `openerByRegion`

**Files:**

- Create: `lib/fightmap/openers.ts`
- Test: `tests/openers.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/openers.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { openerStat, openerByRegion } from "@/lib/fightmap/openers";
import type { Placed } from "@/lib/fightmap";

const p = (over: Partial<Placed>): Placed => ({
  nx: 0.5,
  ny: 0.5,
  won: true,
  side: "attack",
  col: 0,
  row: 0,
  ...over,
});

describe("openerStat", () => {
  it("counts opener duels and wins, ignoring non-openers", () => {
    const stat = openerStat([
      p({ won: true, opener: true }),
      p({ won: false, opener: true }),
      p({ won: true, opener: true }),
      p({ won: true }), // not an opener
    ]);
    expect(stat).toEqual({ won: 2, total: 3, rate: 2 / 3 });
  });

  it("returns zeros (rate 0) when there are no openers", () => {
    expect(openerStat([p({ won: true }), p({ won: false })])).toEqual({
      won: 0,
      total: 0,
      rate: 0,
    });
  });
});

describe("openerByRegion", () => {
  it("tallies opener duels and wins per region index", () => {
    const points = [
      p({ won: true, opener: true }), // region 0
      p({ won: false, opener: true }), // region 0
      p({ won: true, opener: true }), // region 1
      p({ won: true }), // region 1, not opener
      p({ won: false, opener: true }), // region -1, unassigned
    ];
    const assignment = [0, 0, 1, 1, -1];
    expect(openerByRegion(points, assignment, 2)).toEqual([
      { won: 1, total: 2 },
      { won: 1, total: 1 },
    ]);
  });

  it("returns zero tallies for regions with no openers", () => {
    expect(openerByRegion([p({ won: true })], [0], 2)).toEqual([
      { won: 0, total: 0 },
      { won: 0, total: 0 },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/openers.test.ts`
Expected: FAIL — cannot resolve `@/lib/fightmap/openers`.

- [ ] **Step 3: Implement**

Create `lib/fightmap/openers.ts`:

```ts
import type { Placed } from "@/lib/fightmap";

export interface OpenerStat {
  won: number;
  total: number;
  rate: number; // won / total, 0 when total === 0
}

// Aggregate entry (opening-duel) success across a placed set.
export function openerStat(points: Placed[]): OpenerStat {
  let won = 0;
  let total = 0;
  for (const p of points) {
    if (!p.opener) continue;
    total++;
    if (p.won) won++;
  }
  return { won, total, rate: total ? won / total : 0 };
}

// Per-region opener tally, indexed 0..n-1. Points with assignment -1 (or out of
// range) are ignored, matching buildRegionRows' defensive counting.
export function openerByRegion(
  points: Placed[],
  assignment: number[],
  n: number,
): { won: number; total: number }[] {
  const out = Array.from({ length: n }, () => ({ won: 0, total: 0 }));
  points.forEach((p, i) => {
    if (!p.opener) return;
    const r = assignment[i];
    if (r < 0 || r >= n) return;
    out[r].total++;
    if (p.won) out[r].won++;
  });
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/openers.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/fightmap/openers.ts tests/openers.test.ts
git commit -m "Add openerStat and openerByRegion helpers"
```

---

### Task 3: Opener fields on breakdown rows

**Files:**

- Modify: `lib/fightmap/breakdown.ts` (`RegionRow`, `DuelRow`, `buildRegionRows`, `buildDuelRows`)
- Modify: `components/fightmap/FightMap.tsx:108-111` (the `buildRegionRows` call site — pass `points`, keeps tsc green)
- Test: `tests/breakdown.test.ts`

- [ ] **Step 1: Write the failing test**

In `tests/breakdown.test.ts`, the `duel()` factory already spreads `Partial<Placed>`, so `opener` is settable. Add these tests:

```ts
it("tallies per-region openers and appends them to the label", () => {
  const regions = [region({ name: "A Main", winRate: 0.5 })];
  const points = [
    duel({ won: true, opener: true }),
    duel({ won: false, opener: true }),
    duel({ won: true }), // not an opener
  ];
  const rows = buildRegionRows(regions, [0, 0, 0], points);
  expect(rows[0].openerWon).toBe(1);
  expect(rows[0].openerTotal).toBe(2);
  expect(rows[0].label).toBe(
    "A Main, 3 duels, 50% win rate, even, 1 of 2 openings won",
  );
});

it("omits the opener suffix when a region has no openers", () => {
  const rows = buildRegionRows(
    [region({ name: "A Site", winRate: 0.58 })],
    [0, 0],
    [duel({ won: true }), duel({ won: false })],
  );
  expect(rows[0].openerTotal).toBe(0);
  expect(rows[0].label).toBe("A Site, 2 duels, 58% win rate, mostly win");
});

it("flags opener duels and labels them as opening duels", () => {
  const rows = buildDuelRows([
    duel({ won: true, weapon: "Vandal", round: 1, opener: true }),
    duel({ won: false, round: 2 }),
  ]);
  const kill = rows.find((r) => r.won)!;
  expect(kill.opener).toBe(true);
  expect(kill.label).toBe("Kill, Vandal, round 1, opening duel");
  expect(rows.find((r) => !r.won)!.opener).toBe(false);
});
```

The existing `buildRegionRows` tests pass a 2-arg call. Update those existing calls to pass an empty points array as the 3rd arg (no openers → behavior unchanged). For example:

```ts
const rows = buildRegionRows(regions, [0, 0, 0], []);
```

Apply the same `, []` third argument to every existing `buildRegionRows(...)` call in this file.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/breakdown.test.ts`
Expected: FAIL — `buildRegionRows` takes 2 args / `openerWon` not on `RegionRow` / `opener` not on `DuelRow`.

- [ ] **Step 3: Implement**

In `lib/fightmap/breakdown.ts`, import the helper at the top:

```ts
import { openerByRegion } from "@/lib/fightmap/openers";
```

Add fields to the interfaces:

```ts
export interface RegionRow {
  index: number;
  name: string;
  duels: number;
  winRate: number;
  muted: boolean;
  result: Result;
  openerWon: number;
  openerTotal: number;
  label: string;
}

export interface DuelRow {
  index: number;
  won: boolean;
  weapon: string | null;
  round: number | null;
  enemyAgent: string | null;
  opener: boolean;
  label: string;
}
```

Change `buildRegionRows` to take `points` and compute the tally. Replace the signature and the per-row push:

```ts
export function buildRegionRows(
  regions: RegionModel[],
  assignment: number[],
  points: Placed[],
): RegionRow[] {
  const counts = new Array(regions.length).fill(0);
  for (const a of assignment) {
    if (a >= 0 && a < counts.length) counts[a]++;
  }
  const openers = openerByRegion(points, assignment, regions.length);
  const rows: RegionRow[] = [];
  regions.forEach((r, index) => {
    const duels = counts[index];
    if (duels < 1) return;
    const result = resultBand(r.winRate, r.muted);
    const pct = Math.round(r.winRate * 100);
    const op = openers[index];
    const base = `${r.name}, ${duels} duel${duels === 1 ? "" : "s"}, ${pct}% win rate, ${result.toLowerCase()}`;
    rows.push({
      index,
      name: r.name,
      duels,
      winRate: r.winRate,
      muted: r.muted,
      result,
      openerWon: op.won,
      openerTotal: op.total,
      label: op.total ? `${base}, ${op.won} of ${op.total} openings won` : base,
    });
  });
  rows.sort((a, b) => {
    const ra = regions[a.index];
    const rb = regions[b.index];
    const band =
      Math.round(ra.cy * READING_BANDS) - Math.round(rb.cy * READING_BANDS);
    return band !== 0 ? band : ra.cx - rb.cx;
  });
  return rows;
}
```

In `buildDuelRows`, add `opener` to each row and the label. Replace the `.map` body:

```ts
const rows: DuelRow[] = duels.map((d, index) => {
  const weapon = d.weapon ?? null;
  const round = d.round ?? null;
  const enemyAgent = d.enemyAgent ?? null;
  const opener = !!d.opener;
  const parts = [d.won ? "Kill" : "Death"];
  if (weapon) parts.push(weapon);
  if (round != null) parts.push(`round ${round}`);
  if (enemyAgent) parts.push(`vs ${enemyAgent}`);
  if (opener) parts.push("opening duel");
  return {
    index,
    won: d.won,
    weapon,
    round,
    enemyAgent,
    opener,
    label: parts.join(", "),
  };
});
```

Then update the call site in `components/fightmap/FightMap.tsx` (the `regionRows` memo, currently lines ~108-111) to pass `points`:

```ts
const regionRows = useMemo(
  () => buildRegionRows(regionModel, assignment, points),
  [regionModel, assignment, points],
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/breakdown.test.ts && npx tsc --noEmit`
Expected: PASS, tsc clean (FightMap call site now matches the new signature).

- [ ] **Step 5: Commit**

```bash
git add lib/fightmap/breakdown.ts tests/breakdown.test.ts components/fightmap/FightMap.tsx
git commit -m "Thread opener stats into breakdown rows"
```

---

### Task 4: Gold ring marker + dialog row in `DuelMap`

**Files:**

- Modify: `components/fightmap/DuelMap.tsx`

Presentational; verified by `npx tsc --noEmit`, ESLint, and the smoke test in Task 8.

- [ ] **Step 1: Add the ring to `dot(i)`**

In `components/fightmap/DuelMap.tsx`, inside `const dot = (i) => { … }`, after `const color = …` and before the `return (`, the ring is drawn as the first child of the `<g>`. Insert this element as the first node inside the returned `<g>` (right after the transparent hit-area `<circle>`):

```tsx
{
  /* Transparent hit area keeps the whole dot easy to target. */
}
<circle cx={x} cy={y} r="2.4" fill="transparent" />;
{
  p.opener && (
    <circle
      cx={x}
      cy={y}
      r="3"
      fill="none"
      stroke={GOLD}
      strokeWidth="0.5"
      opacity="0.9"
      pointerEvents="none"
      data-opener="true"
    />
  );
}
```

`GOLD` (`#ffd166`) is already defined at the top of the file.

- [ ] **Step 2: Add the opener row to the dialog**

In the dialog JSX (the `fp && (…)` block), add an opener row after the Round row and before the weapon row:

```tsx
<Row
  k="Round"
  v={`${fp.round ?? "—"} · ${fp.side === "attack" ? "⚔ Attack" : "🛡 Defense"}`}
/>;
{
  fp.opener && (
    <Row k="Opener" v={fp.won ? "⚡ First blood" : "⚡ Lost entry"} />
  );
}
{
  fp.weapon && <Row k="Weapon" v={fp.weapon} />;
}
```

- [ ] **Step 3: Verify build + lint**

Run: `npx tsc --noEmit && pnpm lint`
Expected: clean (no type or lint errors).

- [ ] **Step 4: Commit**

```bash
git add components/fightmap/DuelMap.tsx
git commit -m "Mark opening duels with a gold ring and dialog row"
```

---

### Task 5: `OpenerStat` chip component

**Files:**

- Create: `components/fightmap/OpenerStat.tsx`

Presentational; verified by build + Task 8 smoke.

- [ ] **Step 1: Create the component**

Create `components/fightmap/OpenerStat.tsx`:

```tsx
import { winRateColor } from "@/lib/fightmap";
import type { OpenerStat as Stat } from "@/lib/fightmap/openers";

// Headline entry-success chip. Renders nothing when there are no opening duels
// in the current scope.
export default function OpenerStat({ won, total, rate }: Stat) {
  if (total === 0) return null;
  const pct = Math.round(rate * 100);
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        background: "#161b26",
        border: "1px solid #222a38",
        borderRadius: 10,
        padding: "8px 12px",
        fontSize: 13,
      }}
    >
      <span style={{ color: "#ffd166" }} aria-hidden="true">
        ⚡
      </span>
      <span
        style={{
          color: "var(--muted)",
          fontSize: 11,
          letterSpacing: ".05em",
          textTransform: "uppercase",
        }}
      >
        Opening duels
      </span>
      <b>
        {won}/{total} won
      </b>
      <span style={{ color: winRateColor(rate), fontWeight: 700 }}>{pct}%</span>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add components/fightmap/OpenerStat.tsx
git commit -m "Add OpenerStat headline chip component"
```

---

### Task 6: Wire the toggle + chip into `FightMap`

**Files:**

- Modify: `components/fightmap/FightMap.tsx`

Presentational wiring; verified by build + Task 8 smoke.

- [ ] **Step 1: Imports + state**

At the top of `components/fightmap/FightMap.tsx`, add imports:

```ts
import OpenerStat from "./OpenerStat";
import { openerStat } from "@/lib/fightmap/openers";
```

Add state next to the other `useState` hooks:

```ts
const [openersOnly, setOpenersOnly] = useState(false);
```

- [ ] **Step 2: Thread the filter into `collectDuels`**

Update the `points` memo so opener filtering flows through the whole pipeline:

```ts
const points = useMemo(() => {
  if (!calib) return [];
  return placeDuels(
    collectDuels(matches, { map, side, time, openersOnly }),
    calib,
  );
}, [matches, map, side, time, openersOnly, calib]);
```

- [ ] **Step 3: Compute the chip stat**

Add after the `points` memo:

```ts
const openers = useMemo(() => openerStat(points), [points]);
```

- [ ] **Step 4: Add the toggle control**

After the LAYER control group's closing `</div>` (the one that closes the LAYER block, just before the `{!calib ? …}` render branch), add a new control group:

```tsx
<div>
  <div
    className="label"
    style={{ color: "var(--muted)", fontSize: 12, marginBottom: 6 }}
  >
    OPENING DUELS
  </div>
  <div
    role="group"
    aria-label="Opening duels filter"
    style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
  >
    <button
      type="button"
      aria-pressed={!openersOnly}
      style={chip(!openersOnly)}
      onClick={onFilter(setOpenersOnly).bind(null, false)}
    >
      All duels
    </button>
    <button
      type="button"
      aria-pressed={openersOnly}
      style={chip(openersOnly)}
      onClick={onFilter(setOpenersOnly).bind(null, true)}
    >
      Openers
    </button>
  </div>
</div>
```

`chip` and `onFilter` already exist in this file (`onFilter` resets the zoom, the desired behavior here).

- [ ] **Step 5: Render the chip above the map**

Inside the final `<>…</>` branch (where data exists), render the chip immediately before the `<div>` that wraps the layer conditional — i.e. right after the `RegionIssueNotice` line:

```tsx
          {polygonMode && (
            <RegionIssueNotice key={map} map={map} issues={issues} />
          )}
          <OpenerStat {...openers} />
          <div>
```

- [ ] **Step 6: Verify build**

Run: `npx tsc --noEmit && pnpm lint`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add components/fightmap/FightMap.tsx
git commit -m "Wire openers toggle and chip into FightMap"
```

---

### Task 7: "Opener %" column + duel ⚡ in `BreakdownTable`

**Files:**

- Modify: `components/fightmap/BreakdownTable.tsx`

Presentational; consumes the `RegionRow`/`DuelRow` opener fields from Task 3. Verified by build + Task 8 smoke.

- [ ] **Step 1: Add the overview "Opener %" column**

In `components/fightmap/BreakdownTable.tsx`, in the non-zoomed (`regionRows`) branch, add a header cell after "Result":

```tsx
                  <th scope="col" style={th}>
                    Result
                  </th>
                  <th scope="col" style={th}>
                    Opener %
                  </th>
```

And a matching body cell after the Result `<td>`:

```tsx
                    <td
                      style={{
                        ...td,
                        color: row.muted ? "#8b93a3" : undefined,
                      }}
                    >
                      {row.result}
                    </td>
                    <td style={td}>
                      {row.openerTotal
                        ? `${row.openerWon}/${row.openerTotal} · ${Math.round(
                            (row.openerWon / row.openerTotal) * 100,
                          )}%`
                        : "—"}
                    </td>
```

- [ ] **Step 2: Add the ⚡ marker to the zoomed duel rows**

In the zoomed (`duelRows`) branch, change the Outcome cell's button content to flag openers:

```tsx
<button
  type="button"
  aria-label={row.label}
  onClick={() => onSelectDuel?.(row.index)}
  style={cellButton}
>
  {row.won ? "Kill" : "Death"}
  {row.opener && (
    <span style={{ color: "#ffd166" }} aria-hidden="true">
      {" "}
      ⚡
    </span>
  )}
</button>
```

(The opener is already in `row.label`, so the screen-reader name stays complete; the ⚡ is decorative.)

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit && pnpm lint`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add components/fightmap/BreakdownTable.tsx
git commit -m "Show opener win rate column and duel marker in breakdown"
```

---

### Task 8: Playwright smoke — chip + toggle

**Files:**

- Modify: `tests/smoke.spec.ts`

- [ ] **Step 1: Inspect the existing FragsMap smoke test**

Open `tests/smoke.spec.ts` and find the test that navigates to `/fragsmap` (reuse its navigation + any data-ready waits). Match its style (locators, `expect` usage, how it reaches the page).

- [ ] **Step 2: Add the opener smoke test**

Add a test that mirrors the existing `/fragsmap` navigation. Use `[data-duel]` (every dot `<g>` carries it) to compare counts:

```ts
test("opening-duel chip renders and the Openers filter thins the map", async ({
  page,
}) => {
  await page.goto("/fragsmap");
  // The headline chip is present whenever the default map has opening duels.
  await expect(page.getByText("Opening duels")).toBeVisible();

  const allDuels = await page.locator("[data-duel]").count();
  await page.getByRole("button", { name: "Openers", exact: true }).click();
  // Openers are a subset, so the visible dot count must not grow.
  await expect
    .poll(async () => page.locator("[data-duel]").count())
    .toBeLessThanOrEqual(allDuels);
});
```

If the existing FragsMap smoke uses a different base path or a fixture/login helper, copy that exact setup instead of the bare `page.goto("/fragsmap")`.

- [ ] **Step 3: Run the smoke test**

Run: `pnpm smoke -- tests/smoke.spec.ts -g "Openers filter thins"`
Expected: PASS. (Playwright starts the app per `playwright.config`; this does not touch `/dev/regions`.)

- [ ] **Step 4: Commit**

```bash
git add tests/smoke.spec.ts
git commit -m "Smoke test opener chip and Openers filter"
```

---

### Task 9: Full gate

- [ ] **Step 1: Run the whole suite**

Run: `pnpm test && npx tsc --noEmit && pnpm lint && pnpm smoke`
Expected: all green — unit tests, tsc clean, lint clean, Playwright smoke pass.

- [ ] **Step 2: Manual visual pass (optional, Kenny)**

Confirm on `/fragsmap`: opener dots show a gold ring; the chip reads `⚡ Opening duels · N/M won · X%`; the breakdown overview has an Opener % column; the `Openers` toggle thins the map and updates the chip; a focused opener duel's dialog shows the Opener row.

---

## Self-review notes

- **Spec coverage:** filter (Task 1), aggregate stats (Task 2), breakdown column + duel flag (Tasks 3/7), ring marker + dialog (Task 4), chip (Tasks 5/6), toggle + wiring (Task 6), tests (Tasks 1–3 unit, Task 8 smoke). All spec sections mapped.
- **Type consistency:** `OpenerStat` interface (`won/total/rate`) defined in Task 2, consumed in Tasks 5/6. `buildRegionRows(regions, assignment, points)` 3-arg signature defined in Task 3, called with `points` in Task 6 (and Task 3 updates the call site to keep tsc green between tasks). `RegionRow.openerWon/openerTotal` and `DuelRow.opener` defined in Task 3, consumed in Task 7.
- **No data recapture** anywhere — `opener` already present on `Duel`/`Placed`.
