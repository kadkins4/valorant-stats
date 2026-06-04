# Vantage Home v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the home page as a full-bleed landing with a larger hero, a reserved Riot ID spot, a synced agent cycle (hero splash + Top-3 card), and four richer equal-height cards (cycling agents, diagonal best/worst map, gun hit-distribution, current-form sparkline), labeled as competitive data, with a sticky footer and reordered nav.

**Architecture:** Next.js 16 App Router, React 19 server components with small `"use client"` islands. Pure logic (aggregations, sparkline geometry) lives in `lib/` and is Vitest-unit-tested. The agent cycle uses a client context provider (`AgentCycleProvider`) that both the hero splash and the Top-3 card subscribe to, so they advance in lockstep. UI is verified with the Playwright smoke suite plus a manual browser screenshot.

**Tech Stack:** Next.js, React, TypeScript, CSS Modules, Vitest, Playwright, valorant-api.com image URLs (already committed in `lib/maps/calibration.json` and `lib/agents/portraits.json`).

---

## File Structure

| File                                                   | Responsibility                                                                       |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `lib/aggregations.ts` (modify)                         | add `hitDistribution`, `recentKdSeries` (pure)                                       |
| `lib/home/sparkline.ts` (new)                          | pure `sparklineGeometry(values, w, h)` → points + trend                              |
| `components/home/Sparkline.tsx` (new)                  | SVG polyline from values                                                             |
| `components/home/CurrentFormCard.tsx` (new)            | record + sparkline + KD/HS/ADR                                                       |
| `components/home/GunCard.tsx` (new)                    | gun name + head/body/leg silhouette + "all guns" caption                             |
| `components/home/BestWorstMap.tsx` (new)               | diagonal-split map card                                                              |
| `components/home/AgentCycleProvider.tsx` (new, client) | 5s tick, index context, reduced-motion                                               |
| `components/home/AgentSplash.tsx` (modify→client)      | consumes cycle index; slow fade                                                      |
| `components/home/AgentsCard.tsx` (new, client)         | name + win% + dots + thumb; quick fade                                               |
| `components/home/Hero.tsx` (modify)                    | bigger; Riot ID spot                                                                 |
| `components/home/home.module.css` (modify)             | full-bleed/grid/card/hero/splash/diagonal/silo/sparkline/rid styles                  |
| `app/home/page.tsx` (modify)                           | full-bleed; build view-models; wrap region in provider; new cards; competitive label |
| `app/layout.tsx` (modify)                              | sticky footer (flex column)                                                          |
| `components/Nav.tsx` (modify)                          | reorder tabs                                                                         |
| `tests/aggregations.test.ts` (modify)                  | tests for new aggregations                                                           |
| `tests/sparkline.test.ts` (new)                        | tests for sparkline geometry                                                         |
| `tests/smoke.spec.ts` (modify)                         | assert competitive label, card titles, nav order                                     |

Shared CSS class names used across tasks (define once, reuse): `.main`, `.stripLabel`, `.cards`, `.card`, `.cardTitle`. Existing reused classes: `.hero`, `.eyebrow`, `.wordmark`, `.pitch`, `.cta`, `.quickStats`, `.quickNum`, `.quickLabel`, `.heroWrap`, `.splash`, `.splashImg`, `.splashGlow`.

---

## Task 1: New aggregations — hit distribution & recent K/D series

**Files:**

- Modify: `lib/aggregations.ts`
- Test: `tests/aggregations.test.ts`

- [ ] **Step 1: Add failing tests.** Append to `tests/aggregations.test.ts` (it already imports `byMap, currentForm` and defines a factory `M(...)`; extend the import and reuse `M`):

Change the existing import line:

```ts
import { byMap, currentForm } from "@/lib/aggregations";
```

to:

```ts
import {
  byMap,
  currentForm,
  hitDistribution,
  recentKdSeries,
} from "@/lib/aggregations";
```

Then append at the end of the file:

```ts
describe("hitDistribution", () => {
  it("returns head/body/leg as percentages summing ~100", () => {
    const rows = [
      M({ shotsHead: 10, shotsBody: 30, shotsLeg: 10 }), // 50 shots
      M({ shotsHead: 15, shotsBody: 30, shotsLeg: 5 }), // 50 shots
    ];
    const d = hitDistribution(rows);
    expect(d.head).toBe(25); // 25/100
    expect(d.body).toBe(60); // 60/100
    expect(d.leg).toBe(15); // 15/100
  });
  it("returns zeros when there are no shots", () => {
    expect(
      hitDistribution([M({ shotsHead: 0, shotsBody: 0, shotsLeg: 0 })]),
    ).toEqual({
      head: 0,
      body: 0,
      leg: 0,
    });
    expect(hitDistribution([])).toEqual({ head: 0, body: 0, leg: 0 });
  });
});

describe("recentKdSeries", () => {
  it("returns per-game K/D for the last n matches, oldest→newest", () => {
    const rows = [
      M({ playedAt: "2026-05-01T00:00:00Z", kills: 10, deaths: 5 }), // 2.0
      M({ playedAt: "2026-05-02T00:00:00Z", kills: 8, deaths: 8 }), // 1.0
      M({ playedAt: "2026-05-03T00:00:00Z", kills: 6, deaths: 12 }), // 0.5
    ];
    expect(recentKdSeries(rows, 2)).toEqual([1, 0.5]); // last 2, chronological
  });
  it("treats zero deaths as kills (no divide-by-zero)", () => {
    expect(recentKdSeries([M({ kills: 7, deaths: 0 })], 5)).toEqual([7]);
  });
  it("returns [] for no matches", () => {
    expect(recentKdSeries([], 20)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail.**

Run: `pnpm test -- tests/aggregations.test.ts`
Expected: FAIL — `hitDistribution`/`recentKdSeries` are not exported.

- [ ] **Step 3: Implement.** Append to `lib/aggregations.ts`:

```ts
export function hitDistribution(rows: MatchSummary[]): {
  head: number;
  body: number;
  leg: number;
} {
  let head = 0,
    body = 0,
    leg = 0;
  for (const m of rows) {
    head += m.shotsHead;
    body += m.shotsBody;
    leg += m.shotsLeg;
  }
  const total = head + body + leg;
  if (!total) return { head: 0, body: 0, leg: 0 };
  return {
    head: (head * 100) / total,
    body: (body * 100) / total,
    leg: (leg * 100) / total,
  };
}

export function recentKdSeries(rows: MatchSummary[], n: number): number[] {
  return [...rows]
    .sort((a, b) => a.playedAt.localeCompare(b.playedAt)) // oldest→newest
    .slice(-n)
    .map((m) => (m.deaths ? m.kills / m.deaths : m.kills));
}
```

- [ ] **Step 4: Run tests to verify they pass.**

Run: `pnpm test -- tests/aggregations.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add lib/aggregations.ts tests/aggregations.test.ts
git commit -m "Add hitDistribution and recentKdSeries aggregations"
```

---

## Task 2: Shared home CSS scaffolding (full-bleed + cards grid)

**Files:**

- Modify: `components/home/home.module.css`

These classes are consumed by later tasks. Append only — preserve all existing rules.

- [ ] **Step 1: Append shared layout styles** to the END of `components/home/home.module.css`:

```css
/* ===== Home v2 — full-bleed + cards ===== */
.main {
  padding: 0 32px 0;
}
.stripLabel {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--muted);
  margin: 6px 0 14px;
}
.cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  align-items: stretch;
}
.card {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 16px 18px;
  min-height: 184px;
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
}
.cardTitle {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--muted);
  margin: 0 0 10px;
  font-weight: 700;
}
@media (max-width: 900px) {
  .cards {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (max-width: 560px) {
  .cards {
    grid-template-columns: 1fr;
  }
  .main {
    padding: 0 18px;
  }
}
```

- [ ] **Step 2: Verify build compiles.**

Run: `pnpm exec tsc --noEmit`
Expected: PASS (CSS module changes don't affect tsc, but confirm nothing else broke).

- [ ] **Step 3: Commit.**

```bash
git add components/home/home.module.css
git commit -m "Add shared full-bleed + cards-grid styles for home v2"
```

---

## Task 3: Sparkline (pure geometry + component)

**Files:**

- Create: `lib/home/sparkline.ts`
- Create: `components/home/Sparkline.tsx`
- Test: `tests/sparkline.test.ts`

- [ ] **Step 1: Write the failing test.** Create `tests/sparkline.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { sparklineGeometry } from "@/lib/home/sparkline";

describe("sparklineGeometry", () => {
  it("maps values to points across width and flips Y (SVG origin top-left)", () => {
    const g = sparklineGeometry([0, 1, 2], 200, 40);
    // 3 points evenly spaced across width
    expect(g.points).toEqual([
      [0, 40],
      [100, 20],
      [200, 0],
    ]);
  });
  it("reports an up trend when last >= first, down otherwise", () => {
    expect(sparklineGeometry([1, 2, 3], 100, 20).trend).toBe("up");
    expect(sparklineGeometry([3, 2, 1], 100, 20).trend).toBe("down");
  });
  it("handles a flat series without NaN", () => {
    const g = sparklineGeometry([2, 2, 2], 100, 20);
    expect(g.points.every(([, y]) => y === 10)).toBe(true);
    expect(g.trend).toBe("up");
  });
  it("returns empty points for <2 values", () => {
    expect(sparklineGeometry([5], 100, 20).points).toEqual([]);
    expect(sparklineGeometry([], 100, 20).points).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails.**

Run: `pnpm test -- tests/sparkline.test.ts`
Expected: FAIL — cannot resolve `@/lib/home/sparkline`.

- [ ] **Step 3: Implement the helper.** Create `lib/home/sparkline.ts`:

```ts
export type SparklineGeometry = {
  points: [number, number][];
  trend: "up" | "down";
};

// Maps a numeric series to SVG points within [0,w]x[0,h]. Y is flipped so
// higher values sit higher on screen. Flat/degenerate series map to mid-height.
export function sparklineGeometry(
  values: number[],
  w: number,
  h: number,
): SparklineGeometry {
  if (values.length < 2) return { points: [], trend: "up" };
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  const stepX = w / (values.length - 1);
  const points = values.map((v, i): [number, number] => {
    const x = i * stepX;
    const norm = span === 0 ? 0.5 : (v - min) / span;
    const y = h - norm * h;
    return [x, y];
  });
  const trend = values[values.length - 1] >= values[0] ? "up" : "down";
  return { points, trend };
}
```

- [ ] **Step 4: Run test to verify it passes.**

Run: `pnpm test -- tests/sparkline.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the component.** Create `components/home/Sparkline.tsx`:

```tsx
import { sparklineGeometry } from "@/lib/home/sparkline";

export default function Sparkline({
  values,
  width = 200,
  height = 46,
}: {
  values: number[];
  width?: number;
  height?: number;
}) {
  const { points, trend } = sparklineGeometry(values, width, height);
  if (points.length < 2) return null;
  const stroke = trend === "up" ? "var(--green)" : "var(--red)";
  const line = points.map(([x, y]) => `${x},${y}`).join(" ");
  const area = `0,${height} ${line} ${width},${height}`;
  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline points={area} fill={stroke} opacity="0.12" stroke="none" />
      <polyline points={line} fill="none" stroke={stroke} strokeWidth="2.5" />
    </svg>
  );
}
```

- [ ] **Step 6: Type-check.**

Run: `pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 7: Commit.**

```bash
git add lib/home/sparkline.ts components/home/Sparkline.tsx tests/sparkline.test.ts
git commit -m "Add Sparkline component with pure geometry helper"
```

---

## Task 4: CurrentFormCard

**Files:**

- Create: `components/home/CurrentFormCard.tsx`
- Modify: `components/home/home.module.css`

- [ ] **Step 1: Append styles** to the END of `components/home/home.module.css`:

```css
.formRec {
  font-size: 28px;
  font-weight: 900;
}
.formSpark {
  margin: 10px 0 8px;
}
.formSub {
  color: var(--muted);
  font-size: 13px;
  margin-top: auto;
}
```

- [ ] **Step 2: Write the component.** Create `components/home/CurrentFormCard.tsx`:

```tsx
import styles from "./home.module.css";
import Sparkline from "./Sparkline";

export default function CurrentFormCard({
  record,
  kd,
  hs,
  adr,
  series,
}: {
  record: string;
  kd: number;
  hs: number;
  adr: number;
  series: number[];
}) {
  return (
    <div className={styles.card}>
      <h3 className={styles.cardTitle}>Current Form</h3>
      <div className={styles.formRec}>{record}</div>
      <div className={styles.formSpark}>
        <Sparkline values={series} />
      </div>
      <div className={styles.formSub}>
        KD {kd.toFixed(2)} · HS {Math.round(hs)}% · ADR {Math.round(adr)}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Type-check.**

Run: `pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit.**

```bash
git add components/home/CurrentFormCard.tsx components/home/home.module.css
git commit -m "Add CurrentFormCard with sparkline"
```

---

## Task 5: GunCard (hit distribution)

**Files:**

- Create: `components/home/GunCard.tsx`
- Modify: `components/home/home.module.css`

- [ ] **Step 1: Append styles** to the END of `components/home/home.module.css`:

```css
.gunName {
  font-size: 22px;
  font-weight: 800;
  margin-bottom: 4px;
}
.gunCaption {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--muted);
  margin-bottom: 10px;
}
.gunBody {
  display: flex;
  gap: 14px;
  align-items: center;
  margin-top: auto;
}
.silo {
  flex-shrink: 0;
}
.hits {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.hit {
  font-size: 11px;
}
.hitTop {
  display: flex;
  justify-content: space-between;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 3px;
}
.hitTop b {
  color: var(--text);
}
.bar {
  height: 6px;
  background: var(--panel2);
  border-radius: 3px;
  overflow: hidden;
}
.barFill {
  display: block;
  height: 100%;
  border-radius: 3px;
}
```

- [ ] **Step 2: Write the component.** Create `components/home/GunCard.tsx`:

```tsx
import styles from "./home.module.css";

export default function GunCard({
  weapon,
  dist,
}: {
  weapon: string | null;
  dist: { head: number; body: number; leg: number };
}) {
  const rows: [string, number, string][] = [
    ["Head", dist.head, "#ff4655"],
    ["Body", dist.body, "#ff7a86"],
    ["Legs", dist.leg, "#8b93a7"],
  ];
  return (
    <div className={styles.card}>
      <h3 className={styles.cardTitle}>Most-used Gun</h3>
      <div className={styles.gunName}>{weapon ?? "—"}</div>
      <div className={styles.gunCaption}>hit location · all guns</div>
      <div className={styles.gunBody}>
        <svg
          className={styles.silo}
          width="46"
          height="92"
          viewBox="0 0 46 92"
          aria-hidden="true"
        >
          <circle cx="23" cy="12" r="9" fill="#ff4655" opacity="0.95" />
          <rect
            x="11"
            y="24"
            width="24"
            height="34"
            rx="7"
            fill="#ff7a86"
            opacity="0.7"
          />
          <rect
            x="3"
            y="26"
            width="7"
            height="26"
            rx="3.5"
            fill="#ff7a86"
            opacity="0.7"
          />
          <rect
            x="36"
            y="26"
            width="7"
            height="26"
            rx="3.5"
            fill="#ff7a86"
            opacity="0.7"
          />
          <rect
            x="13"
            y="60"
            width="8"
            height="30"
            rx="4"
            fill="#8b93a7"
            opacity="0.55"
          />
          <rect
            x="25"
            y="60"
            width="8"
            height="30"
            rx="4"
            fill="#8b93a7"
            opacity="0.55"
          />
        </svg>
        <div className={styles.hits}>
          {rows.map(([label, pct, color]) => (
            <div className={styles.hit} key={label}>
              <div className={styles.hitTop}>
                <span>{label}</span>
                <b>{Math.round(pct)}%</b>
              </div>
              <div className={styles.bar}>
                <i
                  className={styles.barFill}
                  style={{ width: `${pct}%`, background: color }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Type-check.**

Run: `pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit.**

```bash
git add components/home/GunCard.tsx components/home/home.module.css
git commit -m "Add GunCard with head/body/leg hit distribution"
```

---

## Task 6: BestWorstMap (diagonal split)

**Files:**

- Create: `components/home/BestWorstMap.tsx`
- Modify: `components/home/home.module.css`

- [ ] **Step 1: Append styles** to the END of `components/home/home.module.css`:

```css
.bwCard {
  padding: 0;
}
.bwCard .bwTitle {
  position: absolute;
  top: 14px;
  left: 14px;
  z-index: 3;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--muted);
  margin: 0;
  font-weight: 700;
}
.bwHalf {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 14px;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}
.bwL {
  clip-path: polygon(0 0, 62% 0, 38% 100%, 0 100%);
}
.bwR {
  clip-path: polygon(62% 0, 100% 0, 100% 100%, 38% 100%);
  text-align: right;
}
.bwR .bwInner {
  margin-left: auto;
}
.bwTag {
  font-size: 10px;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: var(--muted);
}
.bwMap {
  font-size: 18px;
  font-weight: 800;
}
.bwPctG {
  color: var(--green);
  font-weight: 900;
  font-size: 22px;
}
.bwPctR {
  color: var(--red);
  font-weight: 900;
  font-size: 22px;
}
```

- [ ] **Step 2: Write the component.** Create `components/home/BestWorstMap.tsx`:

```tsx
import styles from "./home.module.css";

type Side = { map: string; winRate: number; image: string | null };

export default function BestWorstMap({
  best,
  worst,
}: {
  best: Side | null;
  worst: Side | null;
}) {
  const bg = (img: string | null, dark: string) =>
    img
      ? `linear-gradient(180deg, ${dark}, #0e1015ee), url('${img}')`
      : `linear-gradient(180deg, ${dark}, #0e1015ee)`;
  return (
    <div className={`${styles.card} ${styles.bwCard}`}>
      <h3 className={styles.bwTitle}>Best / Worst Map</h3>
      <div
        className={`${styles.bwHalf} ${styles.bwL}`}
        style={{ backgroundImage: bg(best?.image ?? null, "#0b3a24aa") }}
      >
        <div className={styles.bwInner}>
          <div className={styles.bwTag}>Best</div>
          <div className={styles.bwMap}>{best?.map ?? "—"}</div>
          <div className={styles.bwPctG}>{Math.round(best?.winRate ?? 0)}%</div>
        </div>
      </div>
      <div
        className={`${styles.bwHalf} ${styles.bwR}`}
        style={{ backgroundImage: bg(worst?.image ?? null, "#3a0b14aa") }}
      >
        <div className={styles.bwInner}>
          <div className={styles.bwTag}>Worst</div>
          <div className={styles.bwMap}>{worst?.map ?? "—"}</div>
          <div className={styles.bwPctR}>
            {Math.round(worst?.winRate ?? 0)}%
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Type-check.**

Run: `pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit.**

```bash
git add components/home/BestWorstMap.tsx components/home/home.module.css
git commit -m "Add diagonal Best/Worst map card"
```

---

## Task 7: AgentCycleProvider (client context)

**Files:**

- Create: `components/home/AgentCycleProvider.tsx`

- [ ] **Step 1: Write the component.** Create `components/home/AgentCycleProvider.tsx`:

```tsx
"use client";
import { createContext, useContext, useEffect, useState } from "react";

export type CycleAgent = {
  name: string;
  winRate: number;
  games: number;
  portrait: string | null;
};

type CycleState = { agents: CycleAgent[]; index: number };

const CycleCtx = createContext<CycleState>({ agents: [], index: 0 });

export function useAgentCycle(): CycleState {
  return useContext(CycleCtx);
}

export default function AgentCycleProvider({
  agents,
  intervalMs = 5000,
  children,
}: {
  agents: CycleAgent[];
  intervalMs?: number;
  children: React.ReactNode;
}) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (agents.length <= 1) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(
      () => setIndex((i) => (i + 1) % agents.length),
      intervalMs,
    );
    return () => clearInterval(id);
  }, [agents.length, intervalMs]);
  return (
    <CycleCtx.Provider value={{ agents, index }}>{children}</CycleCtx.Provider>
  );
}
```

- [ ] **Step 2: Type-check.**

Run: `pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit.**

```bash
git add components/home/AgentCycleProvider.tsx
git commit -m "Add AgentCycleProvider context (5s tick, reduced-motion aware)"
```

---

## Task 8: AgentSplash → cycle consumer (slow fade)

**Files:**

- Modify: `components/home/AgentSplash.tsx`
- Modify: `components/home/home.module.css`

The current `AgentSplash` takes a `src` prop. It becomes a client component that reads the cycle context instead, and cross-fades on change.

- [ ] **Step 1: Append the slow-fade animation** to the END of `components/home/home.module.css`:

```css
@keyframes splashFade {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
.splashFadeImg {
  animation: splashFade 1.4s ease;
}
@media (prefers-reduced-motion: reduce) {
  .splashFadeImg {
    animation: none;
  }
}
```

- [ ] **Step 2: Replace `components/home/AgentSplash.tsx` ENTIRELY with:**

```tsx
"use client";
import styles from "./home.module.css";
import { useAgentCycle } from "./AgentCycleProvider";

// Decorative only — hidden from assistive tech. Reads the shared agent cycle so
// it stays in sync with the Top-3 card; re-keying the <img> replays the fade.
export default function AgentSplash() {
  const { agents, index } = useAgentCycle();
  const src = agents[index]?.portrait ?? null;
  return (
    <div className={styles.splash} aria-hidden="true">
      <span className={styles.splashGlow} />
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={index}
          className={`${styles.splashImg} ${styles.splashFadeImg}`}
          src={src}
          alt=""
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Type-check.**

Run: `pnpm exec tsc --noEmit`
Expected: PASS. (Note: `app/home/page.tsx` still passes a `src` prop and will type-error until Task 11 rewires it — that's expected; this task's tsc check is for the component file's own correctness. If tsc fails ONLY due to `app/home/page.tsx` passing `src`, that is acceptable and resolved in Task 11. If it fails for any other reason, fix it.)

- [ ] **Step 4: Commit.**

```bash
git add components/home/AgentSplash.tsx components/home/home.module.css
git commit -m "Make AgentSplash consume the agent cycle with a slow fade"
```

---

## Task 9: AgentsCard (cycle consumer, quick fade)

**Files:**

- Create: `components/home/AgentsCard.tsx`
- Modify: `components/home/home.module.css`

- [ ] **Step 1: Append styles** to the END of `components/home/home.module.css`:

```css
.agentName {
  font-size: 30px;
  font-weight: 900;
  margin-top: auto;
}
.agentWr {
  font-size: 14px;
  font-weight: 700;
  color: var(--green);
  margin-top: 4px;
}
.agentWr span {
  color: var(--muted);
  font-weight: 500;
}
.agentThumb {
  position: absolute;
  right: -10px;
  bottom: -10px;
  height: 140px;
  opacity: 0.9;
  filter: grayscale(1) sepia(0.5) hue-rotate(-25deg) saturate(4) brightness(0.9);
  -webkit-mask-image: linear-gradient(225deg, #000, transparent 75%);
  mask-image: linear-gradient(225deg, #000, transparent 75%);
}
.dots {
  display: flex;
  gap: 5px;
  margin-top: 10px;
}
.dots i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--line);
}
.dots i.dotOn {
  background: var(--accent);
}
@keyframes cardFade {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
.agentFade {
  animation: cardFade 0.45s ease;
}
@media (prefers-reduced-motion: reduce) {
  .agentFade {
    animation: none;
  }
}
```

- [ ] **Step 2: Write the component.** Create `components/home/AgentsCard.tsx`:

```tsx
"use client";
import styles from "./home.module.css";
import { useAgentCycle } from "./AgentCycleProvider";

export default function AgentsCard() {
  const { agents, index } = useAgentCycle();
  const a = agents[index];
  return (
    <div className={styles.card}>
      <h3 className={styles.cardTitle}>Top 3 Agents</h3>
      {a?.portrait && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={`t${index}`}
          className={`${styles.agentThumb} ${styles.agentFade}`}
          src={a.portrait}
          alt=""
        />
      )}
      <div
        key={`n${index}`}
        className={`${styles.agentName} ${styles.agentFade}`}
      >
        {a?.name ?? "—"}
      </div>
      <div
        key={`w${index}`}
        className={`${styles.agentWr} ${styles.agentFade}`}
      >
        {Math.round(a?.winRate ?? 0)}%{" "}
        <span>win rate · {a?.games ?? 0} games</span>
      </div>
      <div className={styles.dots}>
        {agents.map((_, k) => (
          <i key={k} className={k === index ? styles.dotOn : undefined} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Type-check.**

Run: `pnpm exec tsc --noEmit`
Expected: PASS (same caveat as Task 8 re: `app/home/page.tsx` — resolved in Task 11).

- [ ] **Step 4: Commit.**

```bash
git add components/home/AgentsCard.tsx components/home/home.module.css
git commit -m "Add cycling Top-3 AgentsCard with win rate"
```

---

## Task 10: Bigger hero + Riot ID spot

**Files:**

- Modify: `components/home/Hero.tsx`
- Modify: `components/home/home.module.css`

- [ ] **Step 1: Update hero sizing + add Riot ID styles.** In `components/home/home.module.css`, REPLACE the existing `.heroWrap` rule and the existing `.hero`, `.wordmark`, `.pitch` rules with the versions below. (Find each existing block and replace it; keep `.eyebrow`, `.cta`, `.quickStats`, `.quickNum`, `.quickLabel`, `.splash*` as-is.)

Replace `.heroWrap { ... }` with:

```css
.heroWrap {
  position: relative;
  overflow: hidden;
  min-height: 62vh;
  display: flex;
  align-items: center;
}
```

Replace `.hero { ... }` with:

```css
.hero {
  position: relative;
  z-index: 2;
  width: 56%;
  padding: 48px 0 36px;
}
```

Replace `.wordmark { ... }` with:

```css
.wordmark {
  margin: 0 0 18px;
  font-weight: 900;
  font-size: clamp(64px, 9vw, 120px);
  line-height: 0.95;
}
```

Replace `.pitch { ... }` with:

```css
.pitch {
  margin: 0 0 24px;
  color: var(--muted);
  font-size: clamp(18px, 1.6vw, 22px);
  line-height: 1.5;
  max-width: 34ch;
}
```

Then APPEND the Riot ID styles to the END of the file:

```css
.ridWrap {
  margin-bottom: 24px;
  max-width: 430px;
}
.ridLabel {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: var(--muted);
  margin-bottom: 7px;
}
.rid {
  display: flex;
  gap: 8px;
}
.ridInput {
  flex: 1;
  background: var(--panel);
  border: 1px dashed #ff465588;
  border-radius: 8px;
  padding: 13px 15px;
  color: var(--muted);
  font-size: 15px;
  opacity: 0.65;
  cursor: not-allowed;
}
.ridBtn {
  background: var(--panel2);
  border: 1px solid var(--line);
  color: var(--muted);
  border-radius: 8px;
  padding: 0 18px;
  font-weight: 700;
  font-size: 14px;
  opacity: 0.65;
  cursor: not-allowed;
}
@media (max-width: 760px) {
  .hero {
    width: 100%;
  }
}
```

- [ ] **Step 2: Replace `components/home/Hero.tsx` ENTIRELY with:**

```tsx
import Link from "next/link";
import styles from "./home.module.css";
import CountUp from "./CountUp";
import type { HomeData } from "@/lib/home/types";

export default function Hero(d: HomeData) {
  return (
    <section className={styles.hero}>
      <p className={styles.eyebrow}>Spatial VALORANT analytics</p>
      <h1 className={styles.wordmark}>
        VAN<span>TAGE</span>
      </h1>
      <p className={styles.pitch}>
        Every kill and death from your ranked matches, plotted on the map — see
        exactly where you win, and where you don&apos;t.
      </p>
      <div className={styles.ridWrap}>
        <div className={styles.ridLabel}>Your stats · Riot ID coming soon</div>
        <div className={styles.rid}>
          <input
            className={styles.ridInput}
            placeholder="Coming soon"
            disabled
            aria-label="Riot ID (coming soon)"
          />
          <button className={styles.ridBtn} disabled>
            Track →
          </button>
        </div>
      </div>
      <Link className={styles.cta} href="/fragsmap">
        Explore FragsMap →
      </Link>
      <div className={styles.quickStats}>
        <div>
          <CountUp className={styles.quickNum} to={d.winPct} />
          <span className={styles.quickLabel}>Win %</span>
        </div>
        <div>
          <CountUp className={styles.quickNum} to={d.kd} decimals={2} />
          <span className={styles.quickLabel}>K/D</span>
        </div>
        <div>
          <CountUp className={styles.quickNum} to={d.matches} />
          <span className={styles.quickLabel}>Matches</span>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Type-check.**

Run: `pnpm exec tsc --noEmit`
Expected: PASS (same Task 11 caveat re: page still type-erroring on AgentSplash `src`).

- [ ] **Step 4: Commit.**

```bash
git add components/home/Hero.tsx components/home/home.module.css
git commit -m "Enlarge hero and add reserved Riot ID spot"
```

---

## Task 11: Compose the home page

**Files:**

- Modify: `app/home/page.tsx`

This wires everything: full-bleed main, the cycle provider around hero + cards, the four new cards, the competitive label, and the new view-models. After this task, the whole home renders and tsc is fully clean.

- [ ] **Step 1: Replace `app/home/page.tsx` ENTIRELY with:**

```tsx
import Nav from "@/components/Nav";
import Hero from "@/components/home/Hero";
import AgentSplash from "@/components/home/AgentSplash";
import AgentsCard from "@/components/home/AgentsCard";
import BestWorstMap from "@/components/home/BestWorstMap";
import GunCard from "@/components/home/GunCard";
import CurrentFormCard from "@/components/home/CurrentFormCard";
import AgentCycleProvider, {
  type CycleAgent,
} from "@/components/home/AgentCycleProvider";
import { agentPortrait } from "@/lib/agents/portraits";
import { getCalibration } from "@/lib/maps/calibration";
import type { HomeData } from "@/lib/home/types";
import homeStyles from "@/components/home/home.module.css";
import { getMatches, getAccountMmr, topWeapon } from "@/lib/db/queries";
import { db } from "@/lib/db/client";
import { matches as matchesTbl } from "@/lib/db/schema";
import {
  byMap,
  byAgent,
  currentForm,
  hitDistribution,
  recentKdSeries,
} from "@/lib/aggregations";

export default async function Home() {
  const [data, ms] = await Promise.all([getAccountMmr(), getMatches()]);
  const a = data?.account,
    mmr = data?.mmr;
  const maps = byMap(ms),
    agents = byAgent(ms),
    form = currentForm(ms, 20);
  const mapsByWin = maps.slice().sort((x, y) => y.winRate - x.winRate);
  const best = mapsByWin[0];
  const worst = mapsByWin.at(-1);
  let gun = null as Awaited<ReturnType<typeof topWeapon>>;
  try {
    gun = topWeapon(
      await db.select({ detail: matchesTbl.detail }).from(matchesTbl),
    );
  } catch {}

  const games = form.games;
  const winPct = games ? Math.round((form.wins / games) * 100) : 0;
  const home: HomeData = {
    name: a?.name ?? "ST1CCS",
    tag: a?.tag ?? "STONE",
    region: a?.region ?? "na",
    level: a?.account_level ?? 0,
    tier: mmr?.current?.tier?.name ?? "—",
    rr: mmr?.current?.rr ?? 0,
    peak: mmr?.peak?.tier?.name ?? "—",
    winPct,
    record: `${form.wins}-${games - form.wins}`,
    kd: Number(form.avgKd.toFixed(2)),
    matches: ms.length,
  };

  const top3: CycleAgent[] = agents.slice(0, 3).map((ag) => ({
    name: ag.agent,
    winRate: ag.winRate,
    games: ag.games,
    portrait: agentPortrait(ag.agent),
  }));
  const dist = hitDistribution(ms);
  const kdSeries = recentKdSeries(ms, 20);
  const bestSide = best
    ? {
        map: best.map,
        winRate: best.winRate,
        image: getCalibration(best.map)?.image ?? null,
      }
    : null;
  const worstSide = worst
    ? {
        map: worst.map,
        winRate: worst.winRate,
        image: getCalibration(worst.map)?.image ?? null,
      }
    : null;

  return (
    <>
      <Nav />
      <main className={homeStyles.main}>
        <AgentCycleProvider agents={top3}>
          <div className={homeStyles.heroWrap}>
            <AgentSplash />
            <Hero {...home} />
          </div>

          <h2 className={homeStyles.stripLabel}>
            Built on real competitive data
          </h2>

          <div className={homeStyles.cards}>
            <AgentsCard />
            <BestWorstMap best={bestSide} worst={worstSide} />
            <GunCard weapon={gun?.weapon ?? null} dist={dist} />
            <CurrentFormCard
              record={`${form.wins}-${games - form.wins}`}
              kd={form.avgKd}
              hs={form.avgHs}
              adr={form.avgAdr}
              series={kdSeries}
            />
          </div>
        </AgentCycleProvider>
      </main>
    </>
  );
}
```

- [ ] **Step 2: Type-check (now fully clean).**

Run: `pnpm exec tsc --noEmit`
Expected: PASS with no errors anywhere.

- [ ] **Step 3: Lint.**

Run: `pnpm lint`
Expected: no new errors (pre-existing MapPicker.tsx warning is fine).

- [ ] **Step 4: Commit.**

```bash
git add app/home/page.tsx
git commit -m "Compose home v2: full-bleed, cycle provider, new cards, competitive label"
```

---

## Task 12: Sticky footer

**Files:**

- Modify: `app/layout.tsx`

- [ ] **Step 1: Edit `app/layout.tsx`.** Make `<body>` a min-height flex column so the footer sits at the bottom. Replace the `<body>` opening tag and wrap `{children}`:

Replace:

```tsx
      <body>
        {children}
        <footer
```

with:

```tsx
      <body style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <div style={{ flex: 1 }}>{children}</div>
        <footer
```

(The closing `</footer>` and `<Analytics />` stay as they are; the new wrapping `<div>` closes right before `<footer`.)

- [ ] **Step 2: Type-check + lint.**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: PASS.

- [ ] **Step 3: Commit.**

```bash
git add app/layout.tsx
git commit -m "Pin portfolio footer to the bottom (sticky footer)"
```

---

## Task 13: Nav reorder

**Files:**

- Modify: `components/Nav.tsx`

- [ ] **Step 1: Reorder the tabs.** In `components/Nav.tsx`, change the `tabs` array so FragsMap comes second:

```tsx
const tabs = [
  { href: "/home", label: "Home", soon: false },
  { href: "/fragsmap", label: "FragsMap", soon: false },
  { href: "/track", label: "Track", soon: true },
  { href: "/improve", label: "Improve", soon: true },
] as const;
```

- [ ] **Step 2: Type-check.**

Run: `pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit.**

```bash
git add components/Nav.tsx
git commit -m "Reorder nav: Home · FragsMap, then Track/Improve (Soon)"
```

---

## Task 14: Smoke tests + full verification

**Files:**

- Modify: `tests/smoke.spec.ts`

- [ ] **Step 1: Update the home smoke test.** In `tests/smoke.spec.ts`, REPLACE the body of the existing `test("home shows the product landing and dashboard", ...)` with:

```ts
test("home shows the product landing and dashboard", async ({ page }) => {
  await page.goto("/");
  await page.waitForURL("**/home");
  await expect(page.getByRole("heading", { name: "VANTAGE" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Explore FragsMap" }),
  ).toBeVisible();
  // competitive label + all four cards present
  await expect(page.getByText("Built on real competitive data")).toBeVisible();
  await expect(page.getByText("Top 3 Agents")).toBeVisible();
  await expect(page.getByText("Best / Worst Map")).toBeVisible();
  await expect(page.getByText("Most-used Gun")).toBeVisible();
  await expect(page.getByText("Current Form")).toBeVisible();
});
```

- [ ] **Step 2: Run the targeted smoke tests.**

Run: `pnpm smoke -- tests/smoke.spec.ts -g "home shows the product landing|nav disables|nav routes resolve|reduced motion"`
Expected: those tests PASS. (Needs DB via `.env`; if the dev server/DB cannot start in this environment, report it as an environment limitation, do not treat as a code failure, and rely on Steps 3–5.)

- [ ] **Step 3: Full unit suite + lint + types.**

Run: `pnpm test && pnpm lint && pnpm exec tsc --noEmit`
Expected: all unit tests PASS (incl. `aggregations`, `sparkline`), lint clean (only the pre-existing MapPicker warning), tsc clean.

- [ ] **Step 4: Production build.**

Run: `pnpm build 2>&1 | tail -20`
Expected: build succeeds, `/home` compiles.

- [ ] **Step 5: Manual visual check.**

Run `pnpm dev`, open `http://localhost:3000/home`. Confirm against the spec:

- Edge-to-edge layout; hero left block ≥ half width with a large wordmark; grayed "Coming soon" Riot ID box.
- After ~5s the hero agent and Top-3 card dissolve together (hero slower); dots track position. With OS "reduce motion" enabled, no cycling and the #1 agent stays.
- Top-3 card shows name + win% (no "games on #1"); Best/Worst is a diagonal card with map art; Gun card shows head/body/legs with an "all guns" caption; Current Form shows W-L + sparkline (no "last 20").
- All four cards equal height; label reads "competitive"; footer pinned to the very bottom; nav order is Home · FragsMap · Track(Soon) · Improve(Soon).
- No console errors.

- [ ] **Step 6: Commit any fixups (if needed).**

```bash
git add -A
git commit -m "Polish home v2 after verification"
```

---

## Self-review notes

- **Spec coverage:** full-bleed (T2/T10/T11), bigger hero (T10), Riot ID grayed "Coming soon" (T10), synced cycle 5s + slow hero / quick card + reduced-motion (T7/T8/T9/T11), Top-3 name+win% no subline (T9), diagonal Best/Worst with map art (T6/T11), gun head/body/leg + "all guns" caption (T5/T11), current form W-L + sparkline no "last 20" (T3/T4/T11), equal-height cards (T2), competitive label (T11), sticky footer (T12), nav reorder (T13), new aggregations + tests (T1), sparkline geometry test (T3), smoke (T14). All covered.
- **Type consistency:** `CycleAgent {name,winRate,games,portrait}` defined in T7, consumed in T8/T9/T11; `useAgentCycle()` returns `{agents,index}` (T7) used in T8/T9; `hitDistribution → {head,body,leg}` (T1) consumed by `GunCard.dist` (T5/T11); `recentKdSeries → number[]` (T1) → `Sparkline.values`/`CurrentFormCard.series` (T3/T4/T11); `sparklineGeometry(values,w,h) → {points,trend}` (T3) used by Sparkline (T3); `BestWorstMap` `Side {map,winRate,image}` (T6) matches `bestSide/worstSide` (T11).
- **No placeholders:** every code step has complete code; commands have expected output.
