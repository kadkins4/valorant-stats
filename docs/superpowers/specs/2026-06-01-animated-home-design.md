# Animated Home (Realm Reveal → Hero → Dashboard) — Design

**Date:** 2026-06-01
**Status:** Approved (pending spec review)
**Goal:** Turn the plain auto-redirect splash + static `/home` into one cinematic, high-quality landing — a "Realm Reveal" intro that dissolves into an animated hero and a staggered dashboard. This is the first thing portfolio visitors see, so it doubles as the app's showpiece entrance.

---

## 1. Experience

One continuous sequence on a single route:

1. **Reveal (A)** — full-screen overlay over the app's dark theme. The handle (`ST1CCS#STONE`) resolves in letter-by-letter from blur, an accent ring draws around it (SVG `stroke-dashoffset`), a subtle accent flash. Choreography ~1.8–2.0s.
2. **Hero (B)** — the overlay dissolves to reveal the hero: rank + RR, large handle, and three headline stats (**Win %, K/D, Matches**) counting up, over a slow living-gradient + scanline background.
3. **Dashboard (C)** — the existing widget cards (Top 3 Agents, Best/Worst Map, Most-used Gun, Current Form) stagger in below the hero.

The prototype at `tmp/home-concepts` (concepts A/B/C) is the agreed visual reference for energy and motion.

---

## 2. Architecture

### Routing — single server-rendered route

- The full experience lives on **`/home`** (a React Server Component), which already `await`s the rank + match data and renders widgets into the HTML. Data is inline at first paint — the reveal never masks a fetch.
- **`/` (root)** becomes a server-side `redirect('/home')` (Next `redirect()` in the RSC) — no render, no client navigation. This eliminates the current `/` → client-`router.push('/home')` hop, so `/home` is the only route that fetches and the data stays server-inline. The old `app/Splash.tsx` (1.5s timer + client redirect) and `app/page.tsx`'s splash render are retired; `app/page.tsx` just redirects.
- Portfolio link continues to land on the app root and gets the reveal.

### Component boundaries

- **`app/home/page.tsx`** (server, existing) — unchanged data fetching. Wraps its output in the new client experience shell and passes already-fetched values (handle, tag, rank tier, RR, win%, K/D, matches count) as props. No data moves to the client; only computed primitives cross the boundary.
- **`components/home/HomeReveal.tsx`** (client) — the orchestration island. Owns the reveal overlay, the once-per-session gate, the font-ready + min-duration + data-ready dissolve logic, and the `prefers-reduced-motion` branch. Renders the reveal overlay + `children` (hero + dashboard) underneath.
- **`components/home/Hero.tsx`** (client or server with a small client counter island) — rank/handle/animated stat counters + animated background. Counters are a thin client piece; static markup can be server-rendered.
- **Existing widgets** (`RankHeader`, `StatCard`) — reused, wrapped so they receive the stagger-in animation via CSS classes/variables. No logic change.
- **`components/home/home.module.css`** (or co-located CSS) — all keyframes and motion. CSS is the backbone.

### Motion strategy — CSS-core, JS-thin

- **All visual motion in CSS** (transform/opacity/`stroke-dashoffset`) so it runs on the compositor thread and stays smooth during hydration.
- **JS only for orchestration**: sequencing the reveal→hero→dashboard handoff and driving number counters. Prefer the Web Animations API / `requestAnimationFrame` for counters; no animation library (no GSAP/Framer) — not needed for this motion set, and avoids the main-thread/dependency cost.
- **Progressive enhancement**: the CSS reveal is valid before JS hydrates; JS enhances timing. If JS never runs, the page still shows the dashboard.

---

## 3. Timing & gating logic (HomeReveal)

The dissolve from reveal → hero fires when **all** of these are satisfied:

1. **Fonts ready** — `await document.fonts.ready` so the handle doesn't swap fonts mid-blur (the single biggest quality detail).
2. **Minimum duration elapsed** — `REVEAL_MIN_MS` (≈1800ms) so the choreography always completes; never a flash-cut.
3. **Data ready** — trivially true here (server-inline), but the gate is written as `max(minDuration, dataReady)` so any future client-fetched element is covered automatically.

A **max cap** (`REVEAL_MAX_MS` ≈ 3500ms) guarantees the reveal dissolves even if `document.fonts.ready` hangs — fail open to the dashboard, never trap the user.

**Once per session:** a `sessionStorage` flag (`vantage:revealed`) — set after the first play. Subsequent navigations to home skip the reveal and render the hero/dashboard immediately. A hard refresh / new tab / fresh visit replays it (portfolio visitors get the show).

**Reduced motion:** if `matchMedia('(prefers-reduced-motion: reduce)')` matches, skip the reveal entirely and render the final state instantly (no counters animating, no overlay). Same instant-render path is the graceful fallback if anything errors.

---

## 4. Data

No new queries. The server route already computes everything:

- Handle/tag/region/level + rank tier + RR → from `getAccountMmr()`.
- Win % / record, K/D → from `currentForm(matches, 20)`.
- Matches count → length of `getMatches()`.
- Widget values → existing `byMap` / `byAgent` / `topWeapon` / `currentForm`.

The hero's three headline stats are **derived from the same already-fetched data** — no duplicate fetching. Empty/À-la-fallback values (e.g. `—`, `0`) must animate/display gracefully (counter to 0, no NaN).

---

## 5. Edge cases & error handling

- **No data / fallback account** (`ST1CCS` default, level 0): reveal still plays with the handle; stats show `0`/`—` without NaN; counters target 0.
- **Font load failure / timeout**: `REVEAL_MAX_MS` cap dissolves anyway.
- **JS disabled / pre-hydration**: CSS-only reveal is valid; dashboard visible regardless.
- **Reduced motion**: instant final state.
- **Re-entry within session**: no reveal (sessionStorage), instant hero/dashboard.
- **SSR/hydration mismatch risk**: the overlay's initial visibility must be deterministic between server and client. Render the overlay in its start state on the server; the once-per-session/reduced-motion decisions run in `useEffect` after mount (so first server paint is consistent, then the client may immediately resolve it). Avoid reading `sessionStorage`/`matchMedia` during render.

---

## 6. Testing

- **Unit (vitest):** the gating helper — `revealResolveDelay({ minMs, fontsReadyAt, dataReadyAt, maxMs })` returns the correct dissolve time for: data-ready-before-min (→ minMs), data-late (→ dataReady), fonts-hang (→ maxMs cap). Pure function, no DOM.
- **Unit:** a `shouldReveal({ reducedMotion, alreadyRevealed })` predicate → false when reduced-motion or already revealed, true otherwise.
- **Smoke (Playwright):** `/home` renders the hero handle and the four widget titles after load (resilient to motion — assert final state, e.g. wait for the dashboard cards' text). Add an assertion that with `prefers-reduced-motion` emulation the dashboard text is visible immediately (no dependence on the reveal).
- **Manual:** orchestrator runs dev server, watches the reveal once, refreshes to confirm replay, navigates away/back to confirm once-per-session skip, toggles reduced-motion.

---

## 7. Scope guard (YAGNI)

In: reveal, hero, staggered widgets, the gating logic, reduced-motion + font-ready quality details.
Out (not now): particles, sound, parallax/scroll-linked motion, animation libraries, redesigning the widgets themselves, touching `/track` or `/fragsmap`.

---

## 8. Out-of-the-box quality checklist

- Compositor-only properties (transform/opacity) for all looping/entrance motion.
- `document.fonts.ready` gate before the blur-resolve.
- `prefers-reduced-motion` honored.
- Once-per-session, capped duration, fail-open dissolve.
- No layout shift when the overlay dissolves (hero occupies the same space underneath).
