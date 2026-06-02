# Map Thumbnails (FragsMap Picker) — Design

**Date:** 2026-06-01
**Status:** Approved (pending spec review)
**Goal:** Replace the text-only pill chips in the FragsMap map picker with compact photo-banner tiles — recognizable, portfolio-polished map selection — while keeping the footprint tight.

---

## 1. Experience

The FragsMap map picker currently renders a wrapping row of text pill chips (one per played map). This becomes a wrapping row of **compact photo tiles (104×62)**:

- Each tile shows the map's **photographic banner** (Riot's `listViewIcon`) with the **map name overlaid** on a bottom dark gradient (no separate label bar — saves height).
- **Selected** tile: accent (`#ff4655`) border + inset accent ring.
- **Hover:** subtle 2px lift (`translateY(-2px)`).
- The user's **12 played maps** wrap to ~2 rows at the app's content width.

Chosen during brainstorming from live mockups: photographic banners over top-down minimaps (minimaps read too uniform at thumbnail size), B2 "compact wrap" sizing over full-size tiles (B1) or a horizontal-scroll row (B3) — best presence-vs-space balance with everything visible at once.

---

## 2. Architecture

### Image source — derived, no new data

`lib/maps/calibration.json` already stores a per-map `image` URL of the form
`https://media.valorant-api.com/maps/<uuid>/displayicon.png`.
The photographic banner lives at the same UUID: `.../listviewicon.png`.

A new pure helper derives it:

```ts
// lib/maps/calibration.ts
export function mapListIcon(map: string): string | null {
  const cal = getCalibration(map);
  if (!cal) return null;
  return cal.image.replace("displayicon", "listviewicon");
}
```

- No new JSON, no new fetch pipeline — DRY off the existing calibration data.
- Returns `null` when the map has no calibration entry → caller falls back to a text chip.

### Image loading

Plain `<img loading="lazy">` with the remote valorant-api URL. This matches the existing heatmap, which already renders the remote valorant-api image via an SVG `<image href>` with **no `next/Image` and no `next.config` `remotePatterns`**. No Next config change is required.

### Component boundaries

- **`components/fightmap/MapPicker.tsx`** (client, existing) — its `return` changes from text chips to photo tiles. Same props (`maps: string[]`, `value: string`, `onChange: (m) => void`). The exported **`chip`** helper is **unchanged** (consumed by `TimeSelector`, `SideToggle`, `RegionEditor`) and is also reused as the per-tile fallback.
- **`components/fightmap/MapPicker.module.css`** (new) — tile layout, the caption gradient, `:hover`, `:focus-visible`, and the selected ring. A small, justified deviation from fightmap's inline-style convention: pseudo-states and the gradient overlay are awkward as inline styles.
- **`lib/maps/calibration.ts`** (existing) — add `mapListIcon`. No other change.

Nothing else changes: the heatmap render, the other selectors, `/track`, and `/home` are untouched.

### Data flow

`FightMap` already computes `maps = mapsOf(matches)` (played maps only) and passes `maps`, `value=map`, `onChange` to `MapPicker`. For each map, `MapPicker` calls `mapListIcon(map)`:

- URL present → photo tile.
- `null` (or the image fails to load at runtime) → text-chip fallback for that one map.

---

## 3. Graceful degradation (per map)

- **No calibration image** (`mapListIcon` returns `null`): render the existing text `chip` for that map.
- **Image load error** (`img onError`): that tile swaps to the text-chip fallback. The component tracks failed-image map names in local state so a broken URL never shows a broken-image icon.
- One missing/broken image never breaks the row; every other tile renders normally.

---

## 4. Accessibility

- Each tile is a `<button aria-pressed={map === value}>`.
- Visible `:focus-visible` outline (keyboard navigation).
- The `<img>` has `alt=""` (decorative) because the map name is present as real caption text inside the button — screen readers announce the name + pressed state.

---

## 5. Edge cases

- **Map with no calibration / not yet supported:** text-chip fallback (see §3).
- **Image 404 / network failure:** `onError` → text-chip fallback.
- **Single played map:** one tile, renders normally.
- **Reduced motion:** the only motion is a 2px hover lift; honor `prefers-reduced-motion: reduce` by disabling the transform transition (cheap, no JS).

---

## 6. Testing

- **Unit (vitest):** `mapListIcon`
  - returns the `listviewicon` URL for a calibrated map (asserts `displayicon`→`listviewicon` swap, same UUID).
  - returns `null` for an unknown/uncalibrated map name.
  - is case-insensitive on the map name (matches `getCalibration` behavior).
- **Smoke (Playwright, `/fragsmap`):**
  - a tile renders for each played map, each exposing its map name as accessible text (assert on the name text, not pixels — resilient to image load).
  - clicking a non-selected tile updates the active selection (the clicked tile becomes `aria-pressed="true"`).
- **Manual:** load `/fragsmap`, confirm tiles render with banners, selection highlights correctly, layout wraps to ~2 rows, and a simulated broken image falls back to a chip.

---

## 7. Scope guard (YAGNI)

In: the FragsMap map-picker tiles, the derived-URL helper, per-map fallback, a11y, the two test layers.

Out (not now): downloading/self-hosting images, `next/Image` migration, changing the other selectors to tiles, map-select for `/track`, animated tile transitions beyond the hover lift, an "All maps" tile (the picker has no "All" option today).
