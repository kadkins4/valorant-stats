# FragsMap Accessibility — Phase 1 (Foundations) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the self-contained a11y "foundations" for FragsMap: color-independent duel dots (kill = circle, death = ✕), a real `role="dialog"` detail popup with focus management, `aria-pressed`/labels on the filter controls, and a global keyboard focus ring.

**Architecture:** Targeted edits to existing client components. The duel dot becomes a `<g data-duel="kill|death">` (transparent hit circle + a circle or an ✕), keeping green/red as a redundant cue; the existing red-circle smoke selectors switch to the stable `data-duel` hook. The `DuelMap` dialog gains dialog semantics + focus-in/return + a minimal Tab trap. Filter toggles expose pressed state. A `:focus-visible` ring lands in `app/globals.css`.

**Tech Stack:** Next.js 16 + React 19 + TS, Playwright smoke, pnpm.

**Spec:** `docs/superpowers/specs/2026-06-03-fragsmap-accessibility-design.md` (Phase 1 items only).

**Note (already done, do NOT re-do):** per-zone win% + duel-count text already renders on the map in **both** Grid (`ZoneGrid.tsx`) and Regions (`RegionView.tsx`) views, so no zone-magnitude text work is needed here. `MapPicker.tsx` already has `aria-pressed` + accessible names — leave it.

---

## File Structure

- **Modify** `components/fightmap/DuelMap.tsx` — death dots as ✕ + `data-duel` hooks (Task 1); dialog semantics + focus management (Task 2).
- **Modify** `components/fightmap/SideToggle.tsx`, `components/fightmap/TimeSelector.tsx`, `components/fightmap/FightMap.tsx` — `aria-pressed` + group labels on controls (Task 3).
- **Modify** `app/globals.css` — global `:focus-visible` ring (Task 4).
- **Modify** `tests/smoke.spec.ts` — update the two dot-clicking smokes to the `data-duel` selector (Task 1); add dialog-role + control `aria-pressed` assertions (Tasks 2–3).

Work happens on the `fragsmap-a11y` branch (already checked out; spec committed at `5ce2658`).

---

## Task 1: Color-independent duel dots (kill = circle, death = ✕)

**Files:**

- Modify: `components/fightmap/DuelMap.tsx`
- Modify: `tests/smoke.spec.ts`

The current `dot(i)` helper returns a `<circle>` filled green (`#5fd07a`) for a win or red (`#e35d6a`) for a loss. Replace it with a `<g data-duel="kill|death">` containing a transparent hit circle (so the whole area stays clickable/hoverable) plus the visible mark: a filled circle for a kill, or an ✕ (with a dark halo for legibility) for a death. Color is retained as a redundant cue. Because death dots are no longer red circles, the two existing smokes that select `circle[fill="#e35d6a"]` must switch to the stable `[data-duel]` hook.

- [ ] **Step 1: Replace the `dot` helper** in `components/fightmap/DuelMap.tsx`

Find the current helper:

```tsx
const dot = (i: number) => {
  const p = points[i];
  const { x, y } = renderPos(i);
  const dim = focused == null && hovered != null && hovered !== i;
  return (
    <circle
      key={i}
      cx={x}
      cy={y}
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
        if (focused === i) {
          setFocused(null);
          setExpanded(null); // collapse on unfocus
        } else {
          setFocused(i);
        }
      }}
    />
  );
};
```

Replace it with:

```tsx
const dot = (i: number) => {
  const p = points[i];
  const { x, y } = renderPos(i);
  const dim = focused == null && hovered != null && hovered !== i;
  const color = p.won ? GREEN : RED;
  return (
    <g
      key={i}
      data-duel={p.won ? "kill" : "death"}
      opacity={dim ? 0.18 : 1}
      style={{ cursor: "pointer", transition: "opacity .12s" }}
      onMouseEnter={() => setHovered(i)}
      onMouseLeave={() => setHovered(null)}
      onClick={(e) => {
        e.stopPropagation();
        if (focused === i) {
          setFocused(null);
          setExpanded(null); // collapse on unfocus
        } else {
          setFocused(i);
        }
      }}
    >
      {/* Transparent hit area keeps the whole dot easy to target. */}
      <circle cx={x} cy={y} r="2.4" fill="transparent" />
      {p.won ? (
        // Kill = filled circle.
        <circle
          cx={x}
          cy={y}
          r="1.6"
          fill={color}
          stroke="#11151d"
          strokeWidth="0.3"
        />
      ) : (
        // Death = ✕ (dark halo behind the colored strokes for legibility).
        <g strokeLinecap="round">
          <line
            x1={x - 1.5}
            y1={y - 1.5}
            x2={x + 1.5}
            y2={y + 1.5}
            stroke="#11151d"
            strokeWidth="1.7"
          />
          <line
            x1={x - 1.5}
            y1={y + 1.5}
            x2={x + 1.5}
            y2={y - 1.5}
            stroke="#11151d"
            strokeWidth="1.7"
          />
          <line
            x1={x - 1.5}
            y1={y - 1.5}
            x2={x + 1.5}
            y2={y + 1.5}
            stroke={color}
            strokeWidth="0.9"
          />
          <line
            x1={x - 1.5}
            y1={y + 1.5}
            x2={x + 1.5}
            y2={y - 1.5}
            stroke={color}
            strokeWidth="0.9"
          />
        </g>
      )}
    </g>
  );
};
```

- [ ] **Step 2: Update the two existing dot-clicking smokes** in `tests/smoke.spec.ts`

Both the "clicking a duel dot opens and closes the focus dialog" test and the "overlapping duels cluster into a badge that fans out and opens details" test select duel dots with `svg circle[fill="#5fd07a"], svg circle[fill="#e35d6a"]`. Death dots are no longer red circles, so replace **every** occurrence of that selector string in `tests/smoke.spec.ts` with `svg [data-duel]`. Concretely:

Change each line that reads:

```ts
page.locator(`svg circle[fill="#5fd07a"], svg circle[fill="#e35d6a"]`);
```

or

```ts
        .locator('svg circle[fill="#5fd07a"], svg circle[fill="#e35d6a"]')
```

to use the selector `svg [data-duel]` instead (keep the surrounding `.last()`, `.first()`, `.count()` calls intact). The cluster **badge** selector `svg circle[fill="#161b26"][stroke="#ffd166"]` is unchanged (badges are still circles). After editing, the dot locators target the `<g data-duel>` groups (clickable), which also conveniently excludes the engagement "you"/enemy circles.

- [ ] **Step 3: Add a shape assertion** to the focus-dialog smoke in `tests/smoke.spec.ts`

Immediately after `await gotoRegions(page); await page.waitForLoadState("networkidle");` in the "clicking a duel dot opens and closes the focus dialog" test, after the region/badge is opened and dots are visible, add an assertion that kills and deaths use different shapes. Insert this right before the line that clicks a dot (`await dot.dispatchEvent("click");`):

```ts
// Color-independent encoding: deaths render as ✕ (lines), not circles.
const deaths = page.locator('svg [data-duel="death"]');
if ((await deaths.count()) > 0) {
  await expect(deaths.first().locator("line").first()).toBeAttached();
}
```

- [ ] **Step 4: Typecheck, lint, run the smokes**

Run: `pnpm exec tsc --noEmit`
Run: `pnpm exec eslint components/fightmap/DuelMap.tsx`
Expected: clean.

Run: `pnpm exec playwright test -g "focus dialog"` and `pnpm exec playwright test -g "fans out"`
Expected: both PASS. If the dot locator now also matches a fanned handle's `<g>` (it should, intentionally), the `.last()`/`.first()` calls still resolve to a real dot — adjust only if a selector returns zero matches.

- [ ] **Step 5: Build**

Run: `pnpm build`
Expected: compiles.

- [ ] **Step 6: Commit**

```bash
git add components/fightmap/DuelMap.tsx tests/smoke.spec.ts
git commit -m "Shape-code duel dots (kill circle, death ✕) for color independence"
```

---

## Task 2: Detail dialog semantics + focus management

**Files:**

- Modify: `components/fightmap/DuelMap.tsx`
- Modify: `tests/smoke.spec.ts`

Make the duel detail popup a real dialog: `role="dialog"`, `aria-modal="true"`, labelled by the KILL/DEATH chip; move focus to the close button when it opens, return focus to whatever was focused before when it closes, and keep Tab within the dialog (minimal trap — the close button is the only focusable control).

- [ ] **Step 1: Import `useRef`** in `components/fightmap/DuelMap.tsx`

Change the React import line:

```tsx
import { useEffect, useMemo, useState } from "react";
```

to:

```tsx
import { useEffect, useMemo, useRef, useState } from "react";
```

- [ ] **Step 2: Add a close-button ref and a focus effect**

Just after the `const [expanded, setExpanded] = useState<number | null>(null);` line, add:

```tsx
const closeRef = useRef<HTMLButtonElement>(null);

// Move focus into the dialog when it opens; restore it when it closes.
useEffect(() => {
  if (focused == null) return;
  const prev = document.activeElement as HTMLElement | null;
  closeRef.current?.focus();
  return () => prev?.focus?.();
}, [focused]);
```

- [ ] **Step 3: Wire dialog semantics onto the popup**

Find the dialog block:

```tsx
      {fp && (
        <div className={styles.dialog} style={corner}>
          <button
            className={styles.close}
            aria-label="Close"
            onClick={() => {
              setFocused(null);
              setExpanded(null);
            }}
          >
            ✕
          </button>
          <span className={styles.out} data-win={fp.won}>
            {fp.won ? "KILL" : "DEATH"}
          </span>
```

Replace those opening lines with (adds `role`/`aria-modal`/`aria-labelledby`, a minimal Tab trap, the `ref`, and an `id` on the chip):

```tsx
      {fp && (
        <div
          className={styles.dialog}
          style={corner}
          role="dialog"
          aria-modal="true"
          aria-labelledby="duel-dialog-title"
          onKeyDown={(e) => {
            if (e.key === "Tab") e.preventDefault(); // trap: only the ✕ is focusable
          }}
        >
          <button
            ref={closeRef}
            className={styles.close}
            aria-label="Close"
            onClick={() => {
              setFocused(null);
              setExpanded(null);
            }}
          >
            ✕
          </button>
          <span id="duel-dialog-title" className={styles.out} data-win={fp.won}>
            {fp.won ? "KILL" : "DEATH"}
          </span>
```

Leave the rest of the dialog body (the `Row`s) unchanged.

- [ ] **Step 4: Add a dialog-semantics assertion** to the focus-dialog smoke in `tests/smoke.spec.ts`

In the "clicking a duel dot opens and closes the focus dialog" test, after the dialog is opened (after the `await expect(page.getByText(/^(KILL|DEATH)$/).first()).toBeVisible();` line), add:

```ts
// Dialog semantics: it's a real dialog and focus moved to the close button.
const dialog = page.getByRole("dialog");
await expect(dialog).toBeVisible();
await expect(page.getByRole("button", { name: "Close" })).toBeFocused();
```

- [ ] **Step 5: Typecheck, lint, run the smoke**

Run: `pnpm exec tsc --noEmit && pnpm exec eslint components/fightmap/DuelMap.tsx`
Expected: clean. (React 19 note: focusing a DOM node inside `useEffect` is allowed — this is a DOM side-effect, not `setState`-in-effect.)

Run: `pnpm exec playwright test -g "focus dialog"`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/fightmap/DuelMap.tsx tests/smoke.spec.ts
git commit -m "Make the duel detail popup a focus-managed role=dialog"
```

---

## Task 3: Control pressed-state + group labels

**Files:**

- Modify: `components/fightmap/SideToggle.tsx`
- Modify: `components/fightmap/TimeSelector.tsx`
- Modify: `components/fightmap/FightMap.tsx`
- Modify: `tests/smoke.spec.ts`

Expose the selected state of the toggle controls to assistive tech via `aria-pressed`, and give each toggle group an accessible group label. `MapPicker` already does this — don't touch it.

- [ ] **Step 1: `SideToggle.tsx` — group role + `aria-pressed`**

Find the wrapper and button:

```tsx
return (
  <div style={{ display: "flex", gap: 8 }}>
    {opts.map((o) => (
      <button
        key={o}
        style={{
          ...chip(o === value),
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 5,
          lineHeight: 1,
        }}
        onClick={() => onChange(o)}
      >
        {icon[o]}
        {label[o]}
      </button>
    ))}
  </div>
);
```

Replace with (adds `role="group"` + `aria-label` on the wrapper, `type="button"` + `aria-pressed` on each button):

```tsx
return (
  <div style={{ display: "flex", gap: 8 }} role="group" aria-label="Side">
    {opts.map((o) => (
      <button
        key={o}
        type="button"
        aria-pressed={o === value}
        style={{
          ...chip(o === value),
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 5,
          lineHeight: 1,
        }}
        onClick={() => onChange(o)}
      >
        {icon[o]}
        {label[o]}
      </button>
    ))}
  </div>
);
```

- [ ] **Step 2: `TimeSelector.tsx` — group label, summary label, `aria-pressed` on the quick-range buttons**

(a) Add `role="group"` + `aria-label="Seasons"` to the outer wrapper. Find:

```tsx
    <div
      style={{
        display: "flex",
        gap: 8,
        flexWrap: "wrap",
        alignItems: "center",
      }}
    >
```

Replace with:

```tsx
    <div
      role="group"
      aria-label="Seasons"
      style={{
        display: "flex",
        gap: 8,
        flexWrap: "wrap",
        alignItems: "center",
      }}
    >
```

(b) Give the season dropdown summary an accessible name. Find:

```tsx
        <summary
          style={{
            ...chip(value.kind === "seasons" && selected.length > 0),
            listStyle: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            userSelect: "none",
          }}
        >
```

Replace with (adds `aria-label`):

```tsx
        <summary
          aria-label={`Choose seasons${selected.length ? `, ${selected.length} selected` : ""}`}
          style={{
            ...chip(value.kind === "seasons" && selected.length > 0),
            listStyle: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            userSelect: "none",
          }}
        >
```

(c) Add `type="button"` + `aria-pressed` to the three quick-range buttons. Find:

```tsx
      <button
        style={chip(value.kind === "all")}
        onClick={() => onChange({ kind: "all" })}
      >
        All time
      </button>
      <button
        style={chip(value.kind === "lastN" && value.n === 10)}
        onClick={() => onChange({ kind: "lastN", n: 10 })}
      >
        Last 10
      </button>
      <button
        style={chip(value.kind === "lastN" && value.n === 20)}
        onClick={() => onChange({ kind: "lastN", n: 20 })}
      >
        Last 20
      </button>
```

Replace with:

```tsx
      <button
        type="button"
        aria-pressed={value.kind === "all"}
        style={chip(value.kind === "all")}
        onClick={() => onChange({ kind: "all" })}
      >
        All time
      </button>
      <button
        type="button"
        aria-pressed={value.kind === "lastN" && value.n === 10}
        style={chip(value.kind === "lastN" && value.n === 10)}
        onClick={() => onChange({ kind: "lastN", n: 10 })}
      >
        Last 10
      </button>
      <button
        type="button"
        aria-pressed={value.kind === "lastN" && value.n === 20}
        style={chip(value.kind === "lastN" && value.n === 20)}
        onClick={() => onChange({ kind: "lastN", n: 20 })}
      >
        Last 20
      </button>
```

- [ ] **Step 3: `FightMap.tsx` — view toggle group + `aria-pressed`**

Find the VIEW toggle:

```tsx
<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
  <button style={chip(view === "grid")} onClick={() => onView("grid")}>
    Grid
  </button>
  <button style={chip(view === "regions")} onClick={() => onView("regions")}>
    Regions
  </button>
</div>
```

Replace with:

```tsx
<div
  role="group"
  aria-label="View"
  style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
>
  <button
    type="button"
    aria-pressed={view === "grid"}
    style={chip(view === "grid")}
    onClick={() => onView("grid")}
  >
    Grid
  </button>
  <button
    type="button"
    aria-pressed={view === "regions"}
    style={chip(view === "regions")}
    onClick={() => onView("regions")}
  >
    Regions
  </button>
</div>
```

- [ ] **Step 4: Add a control-a11y assertion** to `tests/smoke.spec.ts`

Add a new test (place it near the other FragsMap smokes; it relies on the existing `gotoFightMap`/navigation helper — inspect the file and reuse whatever helper the other tests use to land on `/fragsmap`; if a `gotoRegions` helper exists, you can navigate with it then assert the Grid/Regions toggle):

```ts
test("FragsMap filter controls expose pressed state", async ({ page }) => {
  await gotoRegions(page);
  await page.waitForLoadState("networkidle");
  // The View toggle reflects the active view via aria-pressed.
  await expect(page.getByRole("button", { name: "Regions" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("button", { name: "Grid" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  // The Side group is labelled and its options are toggle buttons.
  await expect(
    page
      .getByRole("group", { name: "Side" })
      .getByRole("button", { name: "Both" }),
  ).toHaveAttribute("aria-pressed", "true");
});
```

If `gotoRegions` does not already put the app in Regions view, adjust the expected `aria-pressed` values to match the default view the helper lands on (read the helper first), keeping the assertion meaningful (one pressed, one not).

- [ ] **Step 5: Typecheck, lint, run the smoke**

Run: `pnpm exec tsc --noEmit && pnpm exec eslint components/fightmap/SideToggle.tsx components/fightmap/TimeSelector.tsx components/fightmap/FightMap.tsx`
Expected: clean.

Run: `pnpm exec playwright test -g "pressed state"`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/fightmap/SideToggle.tsx components/fightmap/TimeSelector.tsx components/fightmap/FightMap.tsx tests/smoke.spec.ts
git commit -m "Expose pressed state + group labels on FragsMap controls"
```

---

## Task 4: Global keyboard focus ring

**Files:**

- Modify: `app/globals.css`

Keyboard users need a clearly visible focus indicator. Add a single global `:focus-visible` rule (mouse clicks won't trigger it, only keyboard/AT focus).

- [ ] **Step 1: Append to `app/globals.css`**

Add at the end of the file:

```css
/* Visible keyboard focus indicator (does not show for mouse clicks). */
:focus-visible {
  outline: 3px solid #ffd166;
  outline-offset: 2px;
  border-radius: 4px;
}
```

- [ ] **Step 2: Build + typecheck**

Run: `pnpm exec tsc --noEmit && pnpm build`
Expected: compiles (CSS-only change).

- [ ] **Step 3: Manual check** (`pnpm dev`)

Tab through the FragsMap filter controls and the breakdown/dialog controls — each focused element shows the gold outline; mouse-clicking does not draw it.

- [ ] **Step 4: Commit**

```bash
git add app/globals.css
git commit -m "Add a global keyboard focus-visible ring"
```

---

## Final verification

- [ ] `pnpm exec tsc --noEmit` — clean.
- [ ] `pnpm exec eslint .` — clean (or only the pre-existing accepted `MapPicker` `no-img-element` warning).
- [ ] `pnpm exec vitest run` — all unit tests pass (unchanged from before — Phase 1 adds no unit logic).
- [ ] `pnpm exec playwright test` — all smoke pass, incl. the updated dot smokes, the dialog-role/focus assertion, and the new control `aria-pressed` test.
- [ ] `pnpm build` — production build succeeds.
- [ ] Manual: keyboard-tab the controls (gold focus ring); open a duel detail (focus lands on ✕, Esc closes and returns focus); confirm deaths render as ✕ and kills as circles, distinguishable in grayscale.
