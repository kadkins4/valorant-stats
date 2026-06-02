# Animated Home Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the plain splash + static `/home` with one cinematic landing — a Realm Reveal intro that dissolves into an animated hero and a staggered dashboard — built CSS-core with a thin JS orchestration layer.

**Architecture:** `/` becomes a server redirect to `/home`. `/home` (RSC, existing data fetch) passes computed primitives to a client orchestration island (`HomeReveal`) that owns the once-per-session, font-ready, min-duration / data-ready / max-cap dissolve logic and the `prefers-reduced-motion` branch. The reveal overlay + `Hero` + reused widgets render underneath. All motion is CSS (compositor thread); JS only sequences and drives counters. No animation library.

**Tech Stack:** Next.js 16 (App Router, RSC), React 19, TypeScript, CSS Modules, vitest, Playwright, pnpm.

**Design reference:** `docs/superpowers/specs/2026-06-01-animated-home-design.md` and the agreed prototype `tmp/home-concepts`.

**Shared types** (defined in Task 3, consumed by Tasks 4–6):

```ts
// lib/home/types.ts
export interface HomeData {
  name: string;
  tag: string;
  region: string;
  level: number;
  tier: string; // rank tier name, e.g. "Radiant"
  rr: number;
  peak: string;
  winPct: number; // 0..100
  record: string; // "12-8"
  kd: number;
  matches: number;
}
```

---

### Task 1: Gating helpers (TDD)

Pure functions for the two tricky decisions, isolated from the DOM so they're unit-tested.

**Files:**

- Create: `lib/home/reveal.ts`
- Test: `tests/home-reveal.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/home-reveal.test.ts
import { describe, it, expect } from "vitest";
import { revealResolveDelay, shouldReveal } from "@/lib/home/reveal";

describe("revealResolveDelay", () => {
  const base = { minMs: 1800, maxMs: 3500 };
  it("returns minMs when fonts+data are ready before the minimum", () => {
    expect(
      revealResolveDelay({ ...base, dataReadyAt: 0, fontsReadyAt: 200 }),
    ).toBe(1800);
  });
  it("waits for late data/fonts up to the cap", () => {
    expect(
      revealResolveDelay({ ...base, dataReadyAt: 0, fontsReadyAt: 2400 }),
    ).toBe(2400);
    expect(
      revealResolveDelay({ ...base, dataReadyAt: 2900, fontsReadyAt: 200 }),
    ).toBe(2900);
  });
  it("never exceeds maxMs (fail-open when fonts hang)", () => {
    expect(
      revealResolveDelay({ ...base, dataReadyAt: 0, fontsReadyAt: Infinity }),
    ).toBe(3500);
  });
});

describe("shouldReveal", () => {
  it("plays only when not reduced-motion and not already revealed", () => {
    expect(shouldReveal({ reducedMotion: false, alreadyRevealed: false })).toBe(
      true,
    );
    expect(shouldReveal({ reducedMotion: true, alreadyRevealed: false })).toBe(
      false,
    );
    expect(shouldReveal({ reducedMotion: false, alreadyRevealed: true })).toBe(
      false,
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- home-reveal`
Expected: FAIL — module `@/lib/home/reveal` not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/home/reveal.ts
export function revealResolveDelay(args: {
  minMs: number;
  maxMs: number;
  dataReadyAt: number; // ms from reveal start
  fontsReadyAt: number; // ms from reveal start (Infinity if unknown)
}): number {
  const gate = Math.max(args.minMs, args.dataReadyAt, args.fontsReadyAt);
  return Math.min(args.maxMs, gate);
}

export function shouldReveal(args: {
  reducedMotion: boolean;
  alreadyRevealed: boolean;
}): boolean {
  return !args.reducedMotion && !args.alreadyRevealed;
}

export const REVEAL_MIN_MS = 1800;
export const REVEAL_MAX_MS = 3500;
export const REVEAL_KEY = "vantage:revealed";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- home-reveal`
Expected: PASS (5 assertions).

- [ ] **Step 5: Commit**

```bash
git add lib/home/reveal.ts tests/home-reveal.test.ts
git commit -m "feat: home reveal gating helpers"
```

---

### Task 2: Root redirect + retire splash

**Files:**

- Modify: `app/page.tsx`
- Delete: `app/Splash.tsx`

- [ ] **Step 1:** Replace `app/page.tsx` entirely with a server redirect (drop the `getAccountMmr` call and `<Splash/>` render):

```tsx
// app/page.tsx
import { redirect } from "next/navigation";

export default function Page() {
  redirect("/home");
}
```

- [ ] **Step 2:** Delete `app/Splash.tsx` (`git rm app/Splash.tsx`).

- [ ] **Step 3:** Verify nothing else imports `Splash`.

Run: `grep -rn "Splash" app components lib` → expect no matches.

- [ ] **Step 4:** `pnpm exec tsc --noEmit` → clean.

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx && git rm app/Splash.tsx
git commit -m "feat: redirect / to /home, retire splash"
```

---

### Task 3: Types + motion CSS

All keyframes live here so motion stays CSS-core. The classes are applied by Tasks 4–6.

**Files:**

- Create: `lib/home/types.ts` (the `HomeData` interface above)
- Create: `components/home/home.module.css`

- [ ] **Step 1:** Create `lib/home/types.ts` with the `HomeData` interface from the Shared Types block above.

- [ ] **Step 2:** Create `components/home/home.module.css`:

```css
/* Overlay reveal (Concept A) */
.overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(120% 120% at 50% 0%, #141925 0%, #0c0e13 70%);
  transition:
    opacity 0.6s ease,
    visibility 0.6s ease;
}
.overlayHidden {
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
}
.ring {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: min(58%, 360px);
  aspect-ratio: 1;
}
.ring circle {
  fill: none;
  stroke: var(--accent, #ff4655);
  stroke-width: 2;
  stroke-dasharray: 303;
  stroke-dashoffset: 303;
  animation: draw 1.4s ease forwards 0.2s;
}
.revealHandle {
  font-weight: 900;
  letter-spacing: 0.5px;
  font-size: clamp(28px, 5vw, 54px);
  text-align: center;
}
.revealHandle span {
  display: inline-block;
  opacity: 0;
  filter: blur(14px);
  transform: translateY(14px);
  animation: letterIn 0.6s cubic-bezier(0.2, 0.7, 0.2, 1) forwards;
}
.revealMeta {
  text-align: center;
  color: var(--muted, #8b93a3);
  letter-spacing: 2px;
  font-size: 13px;
  margin-top: 8px;
  opacity: 0;
  animation: fadeUp 0.7s ease forwards 1.1s;
}

/* Hero (Concept B) */
.heroBg {
  position: absolute;
  inset: -40%;
  background: conic-gradient(
    from 0deg,
    transparent,
    rgba(255, 70, 85, 0.1),
    transparent 40%
  );
  animation: spin 14s linear infinite;
  pointer-events: none;
}
.heroEnter {
  opacity: 0;
  animation: fadeUp 0.6s ease forwards;
}

/* Dashboard stagger (Concept C) */
.cardEnter {
  opacity: 0;
  transform: translateY(16px);
  animation: cardIn 0.55s cubic-bezier(0.2, 0.7, 0.2, 1) forwards;
}

@keyframes letterIn {
  to {
    opacity: 1;
    filter: blur(0);
    transform: none;
  }
}
@keyframes draw {
  to {
    stroke-dashoffset: 0;
  }
}
@keyframes fadeUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@keyframes cardIn {
  to {
    opacity: 1;
    transform: none;
  }
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Accessibility: instant, motionless render */
@media (prefers-reduced-motion: reduce) {
  .overlay {
    display: none;
  }
  .ring circle,
  .revealHandle span,
  .revealMeta,
  .heroBg,
  .heroEnter,
  .cardEnter {
    animation: none;
    opacity: 1;
    filter: none;
    transform: none;
    stroke-dashoffset: 0;
  }
}
```

- [ ] **Step 3:** `pnpm exec tsc --noEmit` → clean. Commit:

```bash
git add lib/home/types.ts components/home/home.module.css
git commit -m "feat: home motion css + shared types"
```

---

### Task 4: HomeReveal orchestration island

The client component that gates the dissolve and renders the overlay over `children`.

**Files:**

- Create: `components/home/HomeReveal.tsx`

- [ ] **Step 1:** Create `components/home/HomeReveal.tsx`:

```tsx
"use client";
import { useLayoutEffect, useRef, useState } from "react";
import styles from "./home.module.css";
import {
  REVEAL_MIN_MS,
  REVEAL_MAX_MS,
  REVEAL_KEY,
  shouldReveal,
} from "@/lib/home/reveal";

const useIsoLayout = typeof window === "undefined" ? () => {} : useLayoutEffect;

export default function HomeReveal({
  name,
  tag,
  meta,
  children,
}: {
  name: string;
  tag: string;
  meta: string; // e.g. "RADIANT · 847 RR · NA"
  children: React.ReactNode;
}) {
  // Server renders overlay visible; client decides before paint to avoid flash.
  const [hidden, setHidden] = useState(false);
  const startedRef = useRef(false);

  useIsoLayout(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const alreadyRevealed = sessionStorage.getItem(REVEAL_KEY) === "1";

    if (!shouldReveal({ reducedMotion, alreadyRevealed })) {
      setHidden(true); // instant final state, no flash (layout effect)
      return;
    }

    const start = performance.now();
    let fontsReadyAt = Infinity;
    let resolved = false;
    const finish = () => {
      if (resolved) return;
      resolved = true;
      sessionStorage.setItem(REVEAL_KEY, "1");
      setHidden(true);
    };

    // data is server-inline → ready at 0; fonts gate the blur-resolve.
    const ready = (document as Document & { fonts?: FontFaceSet }).fonts;
    (ready ? ready.ready : Promise.resolve()).then(() => {
      fontsReadyAt = performance.now() - start;
      const wait = Math.min(
        REVEAL_MAX_MS,
        Math.max(REVEAL_MIN_MS, 0, fontsReadyAt),
      );
      const remaining = Math.max(0, wait - (performance.now() - start));
      setTimeout(finish, remaining);
    });

    // hard cap: fail open even if fonts.ready never resolves
    const cap = setTimeout(finish, REVEAL_MAX_MS);
    return () => clearTimeout(cap);
  }, []);

  const letters = `${name}#${tag}`;

  return (
    <>
      <div
        className={`${styles.overlay} ${hidden ? styles.overlayHidden : ""}`}
        aria-hidden="true"
      >
        <svg className={styles.ring} viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="48" />
        </svg>
        <div>
          <div className={styles.revealHandle}>
            {[...letters].map((c, i) => (
              <span key={i} style={{ animationDelay: `${0.15 + i * 0.06}s` }}>
                {c}
              </span>
            ))}
          </div>
          <div className={styles.revealMeta}>{meta}</div>
        </div>
      </div>
      {children}
    </>
  );
}
```

- [ ] **Step 2:** `pnpm exec tsc --noEmit` → clean. `pnpm lint` → clean.

- [ ] **Step 3: Commit**

```bash
git add components/home/HomeReveal.tsx
git commit -m "feat: HomeReveal orchestration island"
```

---

### Task 5: Hero component

**Files:**

- Create: `components/home/Hero.tsx`

- [ ] **Step 1:** Create `components/home/Hero.tsx` (client — owns the rAF counters):

```tsx
"use client";
import { useEffect, useRef } from "react";
import styles from "./home.module.css";
import type { HomeData } from "@/lib/home/types";

function useCountUp(target: number, decimals = 0) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.textContent = target.toFixed(decimals);
      return;
    }
    const dur = 1100;
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      el.textContent = (target * e).toFixed(decimals);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, decimals]);
  return ref;
}

export default function Hero(d: HomeData) {
  const winRef = useCountUp(d.winPct);
  const kdRef = useCountUp(d.kd, 2);
  const matchRef = useCountUp(d.matches);
  return (
    <section
      style={{
        position: "relative",
        overflow: "hidden",
        padding: "44px 0 28px",
      }}
    >
      <div className={styles.heroBg} />
      <div style={{ position: "relative" }}>
        <div
          className={styles.heroEnter}
          style={{
            animationDelay: "0.05s",
            color: "var(--accent)",
            fontWeight: 800,
            letterSpacing: 2,
            fontSize: 13,
          }}
        >
          ◆ {d.tier.toUpperCase()} · {d.rr} RR
        </div>
        <div
          className={styles.heroEnter}
          style={{
            animationDelay: "0.2s",
            fontWeight: 900,
            fontSize: "clamp(30px,5vw,54px)",
          }}
        >
          {d.name} <span style={{ color: "var(--muted)" }}>#{d.tag}</span>
        </div>
        <div style={{ display: "flex", gap: 28, marginTop: 16 }}>
          {[
            { ref: winRef, label: "Win %" },
            { ref: kdRef, label: "K/D" },
            { ref: matchRef, label: "Matches" },
          ].map((s, i) => (
            <div
              key={s.label}
              className={styles.heroEnter}
              style={{ animationDelay: `${0.35 + i * 0.12}s` }}
            >
              <div
                style={{ fontWeight: 900, fontSize: "clamp(22px,3.4vw,34px)" }}
              >
                <span ref={s.ref}>0</span>
              </div>
              <div
                style={{
                  color: "var(--muted)",
                  fontSize: 11,
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                }}
              >
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2:** `pnpm exec tsc --noEmit` + `pnpm lint` → clean.

- [ ] **Step 3: Commit**

```bash
git add components/home/Hero.tsx
git commit -m "feat: animated hero with counters"
```

---

### Task 6: Wire into /home

Compute the primitives, wrap in `HomeReveal`, render `Hero`, stagger the widgets.

**Files:**

- Modify: `app/home/page.tsx`

- [ ] **Step 1:** In `app/home/page.tsx`, after the existing data computation, derive the hero values and build a `HomeData` object:

```ts
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
```

Add imports: `import HomeReveal from "@/components/home/HomeReveal";`, `import Hero from "@/components/home/Hero";`, `import type { HomeData } from "@/lib/home/types";`.

- [ ] **Step 2:** Wrap the returned markup. Replace the current `<RankHeader .../>` block with `Hero`, keep the widget grid, wrap everything (after `<Nav/>`) in `HomeReveal`, and add the stagger class to each widget cell:

```tsx
return (
  <>
    <Nav />
    <HomeReveal
      name={home.name}
      tag={home.tag}
      meta={`${home.tier.toUpperCase()} · ${home.rr} RR · ${home.region.toUpperCase()}`}
    >
      <main
        style={{ maxWidth: 1180, margin: "0 auto", padding: "0 20px 24px" }}
      >
        <Hero {...home} />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))",
            gap: 16,
          }}
        >
          {[
            <StatCard
              key="agents"
              title="Top 3 Agents"
              big={
                agents
                  .slice(0, 3)
                  .map((x) => x.agent)
                  .join(" · ") || "—"
              }
              sub={`${agents[0]?.games ?? 0} games on #1`}
            />,
            <StatCard
              key="maps"
              title="Best / Worst Map"
              big={`${best?.map ?? "—"} / ${worst?.map ?? "—"}`}
              sub={`${best?.winRate.toFixed(0) ?? 0}% vs ${worst?.winRate.toFixed(0) ?? 0}%`}
            />,
            <StatCard
              key="gun"
              title="Most-used Gun"
              big={gun?.weapon ?? "—"}
              sub={gun ? `${gun.kills} kills` : "run backfill"}
            />,
            <StatCard
              key="form"
              title="Current Form"
              big={`${form.wins}-${form.games - form.wins}`}
              sub={`KD ${form.avgKd.toFixed(2)} · HS ${form.avgHs.toFixed(0)}% · ADR ${form.avgAdr.toFixed(0)}`}
            />,
          ].map((card, i) => (
            <div
              key={i}
              className={homeStyles.cardEnter}
              style={{ animationDelay: `${0.9 + i * 0.1}s` }}
            >
              {card}
            </div>
          ))}
        </div>
      </main>
    </HomeReveal>
  </>
);
```

Add `import homeStyles from "@/components/home/home.module.css";`. (Server components can import CSS-module class maps for use as `className` strings.) Keep `RankHeader` import only if still used elsewhere; otherwise remove it to satisfy lint.

- [ ] **Step 3:** `pnpm exec tsc --noEmit` + `pnpm lint` → clean.

- [ ] **Step 4:** Manual: `pnpm dev`, load `/` → redirects to `/home` → reveal plays → hero + widgets stagger in. Refresh → replays. Navigate to `/track` and back → no reveal (session). Toggle OS reduced-motion → instant dashboard.

- [ ] **Step 5: Commit**

```bash
git add app/home/page.tsx
git commit -m "feat: wire animated home (reveal + hero + staggered widgets)"
```

---

### Task 7: Smoke tests + full gate

**Files:**

- Modify: `tests/smoke.spec.ts`

- [ ] **Step 1:** Update the splash smoke test (the old one waits for `/home` and "Current Form"). The redirect still lands on `/home`; assert the hero + a widget render. Add a reduced-motion case:

```ts
test("home reveals hero and dashboard", async ({ page }) => {
  await page.goto("/");
  await page.waitForURL("**/home");
  // Final state is reachable regardless of the intro animation.
  await expect(page.getByText("ST1CCS")).toBeVisible();
  await expect(page.getByText("Current Form")).toBeVisible();
});

test("reduced motion shows dashboard immediately", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/home");
  await expect(page.getByText("Top 3 Agents")).toBeVisible({ timeout: 3000 });
});
```

Keep the existing nav/fragsmap/region-editor smoke tests.

- [ ] **Step 2: Full gate**

Run, expecting all green:

```bash
pnpm test
pnpm exec tsc --noEmit
pnpm lint
pnpm build
pnpm smoke
```

- [ ] **Step 3:** Orchestrator: dev server, capture the reveal (screenshot mid-animation + final) for Kendall to review before merge.

- [ ] **Step 4: Commit**

```bash
git add tests/smoke.spec.ts
git commit -m "test: smoke for animated home + reduced motion"
```

---

## Self-review notes

- **Spec coverage:** reveal/hero/dashboard (Tasks 3–6), CSS-core + JS orchestration (Tasks 3–5), font-ready + min/max/data gating (Task 1 helper + Task 4 wiring), once-per-session (Task 4), reduced-motion (CSS Task 3 + JS Tasks 4–5), single server route (Task 2), no new queries (Task 6 reuses computed data), tests (Tasks 1 & 7).
- **Type consistency:** `HomeData` defined once (Task 3), consumed by `Hero` (Task 5) and built in `/home` (Task 6). `REVEAL_MIN_MS`/`REVEAL_MAX_MS`/`REVEAL_KEY`/`shouldReveal`/`revealResolveDelay` defined in Task 1, used in Task 4. `home.module.css` class names (`overlay`, `overlayHidden`, `ring`, `revealHandle`, `revealMeta`, `heroBg`, `heroEnter`, `cardEnter`) defined in Task 3, used in Tasks 4–6.
- **Note for implementer:** `revealResolveDelay` is the unit-tested model of the dissolve math; Task 4's effect implements the same logic with live timers/promises (kept simple). If you prefer, refactor Task 4 to call `revealResolveDelay` directly once `fontsReadyAt` is known — behavior is identical.
- **Deferred (per spec YAGNI):** particles, sound, parallax, animation libraries, widget redesign.

```

```
