# Map Thumbnails Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the FragsMap map picker's text pill chips with compact photo-banner tiles (104×62, name overlaid), derived from existing calibration data, with a per-map text-chip fallback.

**Architecture:** A new pure helper `mapListIcon(map)` derives Riot's `listViewIcon` URL by swapping `displayicon`→`listviewicon` in the calibration `image` URL (no new data). `MapPicker` renders a photo tile per map, falling back to the existing `chip` text button when a map has no calibration or its image fails to load. Motion and pseudo-states live in a small co-located CSS module.

**Tech Stack:** Next.js 16 (App Router, client components), React 19, TypeScript, Vitest (`@/` alias), Playwright smoke (`pnpm smoke`). Package manager: pnpm.

**Reference spec:** `docs/superpowers/specs/2026-06-01-map-thumbnails-design.md`

---

## File Structure

- `lib/maps/calibration.ts` (modify) — add the pure `mapListIcon` helper. Already exports `getCalibration`.
- `tests/calibration.test.ts` (modify) — add unit tests for `mapListIcon`.
- `components/fightmap/MapPicker.tsx` (modify) — render photo tiles; keep the `chip` export and reuse it as the per-map fallback.
- `components/fightmap/MapPicker.module.css` (create) — tile layout, caption gradient, hover/focus, reduced-motion.
- `tests/smoke.spec.ts` (modify) — add a Playwright assertion that tiles render and selection updates.

**Context the implementer needs:**

- `getCalibration(map)` lowercases the map name and returns `{ name, image, ... } | undefined`, where `image` looks like `https://media.valorant-api.com/maps/<uuid>/displayicon.png`.
- The existing heatmap renders the remote valorant-api image with a plain remote URL (SVG `<image href>`) — there is **no `next/Image` and no `next.config` `remotePatterns`**. Use a plain `<img>`; do not add Next image config.
- `MapPicker`'s `chip` export is imported by `TimeSelector`, `SideToggle`, and `RegionEditor`. It MUST keep its current signature and behavior.
- `--accent` is a global CSS variable (already used by `chip` as `var(--accent)`), value `#ff4655`.
- The picker receives `maps = mapsOf(matches)` (the player's played maps; ~12 in the committed snapshot, all calibrated).

---

### Task 1: `mapListIcon` derived-URL helper

**Files:**

- Modify: `lib/maps/calibration.ts` (add export after `getCalibration`, around line 18)
- Test: `tests/calibration.test.ts` (add a `describe` block)

- [ ] **Step 1: Write the failing tests**

Add this block to the end of `tests/calibration.test.ts`, and add `mapListIcon` to the existing import from `@/lib/maps/calibration`:

```ts
import {
  transformCoord,
  getCalibration,
  getCallouts,
  mapListIcon,
  type MapCalibration,
} from "@/lib/maps/calibration";

// ...existing tests unchanged...

describe("mapListIcon", () => {
  it("derives the listViewIcon URL from a calibrated map", () => {
    const url = mapListIcon("Ascent");
    expect(url).not.toBeNull();
    expect(url).toContain("listviewicon.png");
    expect(url).not.toContain("displayicon");
    // same UUID/path as the calibration image, only the icon filename swapped
    expect(url).toBe(
      getCalibration("Ascent")!.image.replace("displayicon", "listviewicon"),
    );
  });
  it("is case-insensitive on the map name", () => {
    expect(mapListIcon("ascent")).toBe(mapListIcon("Ascent"));
  });
  it("returns null for an unknown map", () => {
    expect(mapListIcon("Nonexistent")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run tests/calibration.test.ts`
Expected: FAIL — `mapListIcon` is not exported (`mapListIcon is not a function` / import error).

- [ ] **Step 3: Implement the helper**

In `lib/maps/calibration.ts`, add immediately after the `getCalibration` function (after line 18):

```ts
// The photographic banner (Riot's listViewIcon) lives at the same map UUID as
// the displayicon used for calibration — derive it, no extra data needed.
export function mapListIcon(map: string): string | null {
  const cal = getCalibration(map);
  if (!cal) return null;
  return cal.image.replace("displayicon", "listviewicon");
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run tests/calibration.test.ts`
Expected: PASS (all `mapListIcon` cases green, existing cases still green).

- [ ] **Step 5: Commit**

```bash
git add lib/maps/calibration.ts tests/calibration.test.ts
git commit -m "Adds mapListIcon helper for map banner URLs"
```

---

### Task 2: Photo-tile MapPicker + smoke test

**Files:**

- Create: `components/fightmap/MapPicker.module.css`
- Modify: `components/fightmap/MapPicker.tsx`
- Test: `tests/smoke.spec.ts` (add one test)

- [ ] **Step 1: Write the failing smoke test**

Add this test to `tests/smoke.spec.ts` (after the existing `fragsmap renders the fight map` test):

```ts
test("fragsmap map tiles render and select", async ({ page }) => {
  await page.goto("/fragsmap");
  // Tiles render thumbnail images (text chips had no images).
  await expect(page.locator("button img").first()).toBeVisible();
  // Selecting a map marks its tile pressed (tiles set aria-pressed; chips did not).
  const bind = page.getByRole("button", { name: "Bind" });
  await expect(bind).toBeVisible();
  await bind.click();
  await expect(bind).toHaveAttribute("aria-pressed", "true");
});
```

- [ ] **Step 2: Run the smoke test to verify it fails**

Run: `pnpm smoke -- tests/smoke.spec.ts -g "map tiles render and select"`
Expected: FAIL — the current picker renders text chips with no `<img>` and no `aria-pressed` attribute (the `button img` locator and the `aria-pressed="true"` assertion both fail).

- [ ] **Step 3: Create the CSS module**

Create `components/fightmap/MapPicker.module.css`:

```css
.row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tile {
  position: relative;
  width: 104px;
  height: 62px;
  border-radius: 10px;
  overflow: hidden;
  cursor: pointer;
  border: 2px solid transparent;
  background: #0a0c11;
  padding: 0;
  flex: 0 0 auto;
  transition:
    border-color 0.15s,
    transform 0.15s;
}

.tile:hover {
  transform: translateY(-2px);
}

.tile:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.active {
  border-color: var(--accent);
}

.img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cap {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 12px 6px 4px;
  font-size: 11px;
  font-weight: 700;
  text-align: left;
  color: #fff;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.82), rgba(0, 0, 0, 0));
}

@media (prefers-reduced-motion: reduce) {
  .tile {
    transition: none;
  }
  .tile:hover {
    transform: none;
  }
}
```

- [ ] **Step 4: Rewrite MapPicker to render tiles**

Replace the entire contents of `components/fightmap/MapPicker.tsx` with:

```tsx
"use client";

import { useState } from "react";
import { mapListIcon } from "@/lib/maps/calibration";
import styles from "./MapPicker.module.css";

const chip = (active: boolean): React.CSSProperties => ({
  padding: "5px 13px",
  borderRadius: 14,
  fontSize: 13,
  fontWeight: active ? 700 : 400,
  cursor: "pointer",
  border: "none",
  background: active ? "var(--accent)" : "#222a38",
  color: active ? "#fff" : "#aeb6c6",
  transition: "background 0.15s",
});

export default function MapPicker({
  maps,
  value,
  onChange,
}: {
  maps: string[];
  value: string;
  onChange: (m: string) => void;
}) {
  // Maps whose banner image failed to load — fall back to a text chip.
  const [failed, setFailed] = useState<Set<string>>(new Set());

  return (
    <div className={styles.row}>
      {maps.map((m) => {
        const active = m === value;
        const url = mapListIcon(m);

        if (!url || failed.has(m)) {
          return (
            <button
              key={m}
              aria-pressed={active}
              style={chip(active)}
              onClick={() => onChange(m)}
            >
              {m}
            </button>
          );
        }

        return (
          <button
            key={m}
            aria-pressed={active}
            className={`${styles.tile} ${active ? styles.active : ""}`}
            onClick={() => onChange(m)}
          >
            <img
              className={styles.img}
              src={url}
              alt=""
              loading="lazy"
              onError={() => setFailed((prev) => new Set(prev).add(m))}
            />
            <span className={styles.cap}>{m}</span>
          </button>
        );
      })}
    </div>
  );
}

export { chip };
```

- [ ] **Step 5: Run the smoke test to verify it passes**

Run: `pnpm smoke -- tests/smoke.spec.ts -g "map tiles render and select"`
Expected: PASS — tiles render images and the clicked "Bind" tile reports `aria-pressed="true"`.

- [ ] **Step 6: Run lint, typecheck/build, and the full test suites**

Run: `pnpm lint`
Expected: no errors.

Run: `pnpm build`
Expected: build succeeds (TypeScript compiles; `MapPicker` and its three `chip` consumers — `TimeSelector`, `SideToggle`, `RegionEditor` — still type-check).

Run: `pnpm test`
Expected: all vitest suites pass.

Run: `pnpm smoke`
Expected: all Playwright smoke tests pass (existing + new).

- [ ] **Step 7: Commit**

```bash
git add components/fightmap/MapPicker.tsx components/fightmap/MapPicker.module.css tests/smoke.spec.ts
git commit -m "Adds photo-banner tiles to FragsMap map picker"
```

---

## Self-Review

**1. Spec coverage:**

- §1 Experience (compact photo tiles, name overlay, selected/hover) → Task 2 (CSS module + tile markup). ✓
- §2 `mapListIcon` derived URL → Task 1. ✓
- §2 plain `<img>`, no Next config → Task 2 Step 4 (uses `<img>`); plan context calls it out. ✓
- §2 keep `chip` export → Task 2 keeps `export { chip }` and reuses it. ✓
- §3 graceful degradation (null calibration + onError) → Task 2 `if (!url || failed.has(m))` + `onError`. ✓
- §4 accessibility (`aria-pressed`, `:focus-visible`, `alt=""`) → Task 2 markup + CSS. ✓
- §5 reduced motion → CSS `@media (prefers-reduced-motion: reduce)`. ✓
- §6 tests (unit `mapListIcon`, smoke tiles+selection) → Task 1 + Task 2. ✓
- §7 scope guard (only the picker) → only `MapPicker`, its CSS, the helper, and tests change. ✓

**2. Placeholder scan:** No TBD/TODO; every code step shows complete code. ✓

**3. Type consistency:** `mapListIcon(map: string): string | null` is defined in Task 1 and consumed identically in Task 2. `chip(active: boolean)` signature unchanged. Props `{ maps, value, onChange }` unchanged. ✓
