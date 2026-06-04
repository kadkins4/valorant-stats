# FragsMap Data-Fidelity Fix — Design Spec

**Date:** 2026-06-04
**Status:** Approved
**Scope:** Bug fix to engagement-position extraction in `normalizeDetail`, plus recapture + snapshot regen.

## Problem

On the FragsMap, hovering many duel dots shows the dot but no engagement (the "your spot → enemy spot" tracer and markers). Only ~49% of duels carry both positions. This reads as broken.

Root cause is a code bug, not bad or missing data. In each HenrikDev v4 kill record:

- `k.location` is the **victim's** position (where the kill landed).
- `k.player_locations` lists the **other alive** players — it never includes the victim.

The current extraction looks up the enemy's position by searching `player_locations`:

```ts
const enemyLoc = locOf(enemyPuuid);
```

- On a **death** (I'm the victim): enemy = the killer, who is alive and present in `player_locations` → found. ✓
- On a **kill** (I'm the killer): enemy = the victim, who is never in `player_locations` → `undefined`. ✗

So **every kill silently drops the enemy position**, which is why coverage sits near half (deaths keep it, kills lose it).

The enemy's position on a kill is simply `k.location` (the victim's spot).

## Verification

Simulated current vs. fixed extraction across the raw capture (`prototype/raw/matches_competitive.json`, 256 duels for the account puuid):

| Extraction | Duels with both positions |
| ---------- | ------------------------- |
| Current    | 135 / 256 (**52.7%**)     |
| Fixed      | 256 / 256 (**100%**)      |

Kills with the fix: 121/121 both positions. Deaths (unchanged): 135/135.

## The Fix

In `lib/transform.ts`, `normalizeDetail`, mirror the existing `myLoc` special-case onto `enemyLoc`:

```ts
// Current
const myLoc = iDied ? k.location : locOf(puuid);
const enemyLoc = locOf(enemyPuuid);

// Fixed — on a kill the enemy IS the victim, whose position is k.location
const myLoc = iDied ? k.location : locOf(puuid);
const enemyLoc = iKilled ? k.location : locOf(enemyPuuid);
```

Symmetry: `k.location` is always the loser's position (victim). `myLoc` already uses it when I lost (`iDied`); `enemyLoc` should use it when the enemy lost (`iKilled`).

`locOf` and the `player_locations` puuid-path handling are unchanged.

## Data Flow

`normalizeDetail` writes `matches.detail` jsonb. The committed `data/snapshot.json` is the production fallback. To realize the fix in the shipped app:

1. Apply the code fix.
2. Re-run `scripts/recapture.ts` — re-normalizes all stored match detail with the fixed extraction. (Operator step; needs live `.env` credentials. Run by Kendall.)
3. Run `pnpm sync` — exports full DB state to `data/snapshot.json`.

No API re-fetch of match data from HenrikDev is required; `recapture` re-normalizes already-stored raw detail.

## Testing

- **Unit (Vitest):** Add a `normalizeDetail` test asserting a _kill_ record (where the victim is absent from `player_locations`) yields `ex/ey` equal to `k.location`. Add/confirm a _death_ record still yields `ex/ey` from the killer's `player_locations` entry. Use the real nested `{ player: { puuid } }` shape.
- **Regression:** Existing transform tests must still pass.
- **Manual:** After recapture+sync, hovering kill dots on the FragsMap shows the engagement tracer.

## Out of Scope

The spatial-zoom redesign and the accessible data layer are separate specs. This piece is the position-extraction bug fix only.
