# FragsMap Data-Fidelity Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the enemy-position extraction bug in `normalizeDetail` so every duel (kill _and_ death) carries the enemy's position, raising engagement-tracer coverage from ~49% to ~100%.

**Architecture:** In each HenrikDev v4 kill record, `k.location` is the victim's position and `k.player_locations` lists only the _other alive_ players (never the victim). The current code looks up the enemy in `player_locations`, which works for deaths (enemy = alive killer) but fails for kills (enemy = absent victim). The fix mirrors the existing `myLoc` special-case: on a kill, the enemy's position is `k.location`. After the code fix, an operator runs recapture + sync to refresh the production snapshot.

**Tech Stack:** TypeScript, Vitest, Next.js. Tests run with `pnpm exec vitest run`.

---

### Task 1: Fix enemy-position extraction in `normalizeDetail`

**Files:**

- Modify: `lib/transform.ts:128` (the `enemyLoc` assignment)
- Test: `tests/transform.test.ts` (add one test; update the existing "degrades" test and the `detail2` kill fixture)

Context: `normalizeDetail(detail, puuid)` loops over `detail.kills`. For each duel it computes `iKilled`/`iDied`, `enemyPuuid`, and a `locOf(pid)` helper that searches `k.player_locations` for a position. Line 127 already special-cases my own position on a death (`myLoc = iDied ? k.location : locOf(puuid)`). Line 128 currently reads `const enemyLoc = locOf(enemyPuuid);`.

- [ ] **Step 1: Write the failing test**

Add this test inside `tests/transform.test.ts`, after the existing `describe("normalizeDetail Bucket C", ...)` block (around line 239). It models the _real_ v4 shape where the victim is absent from `player_locations`:

```ts
describe("normalizeDetail enemy position on a kill", () => {
  const realKill = {
    players: [
      { puuid: "me", team_id: "Red", agent: { name: "Jett" } },
      { puuid: "foe", team_id: "Blue", agent: { name: "Reyna" } },
    ],
    rounds: [{ id: 0, plant: { player: { team: "Red" } } }],
    kills: [
      {
        round: 0,
        time_in_round_in_ms: 3000,
        killer: { puuid: "me" },
        victim: { puuid: "foe" },
        location: { x: 700, y: 800 }, // the victim's (enemy's) position
        weapon: { name: "Vandal" },
        // Real v4: only the OTHER alive players appear; the victim never does.
        player_locations: [
          { player: { puuid: "me" }, location: { x: 100, y: 120 } },
        ],
      },
    ],
  };

  it("reads the enemy position from the kill location when the victim is absent from player_locations", () => {
    const { duels } = normalizeDetail(realKill, "me");
    expect(duels[0]).toMatchObject({
      won: true,
      mx: 100,
      my: 120,
      ex: 700,
      ey: 800,
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run tests/transform.test.ts -t "enemy position from the kill location"`
Expected: FAIL — `ex` is `undefined` (received object missing `ex: 700, ey: 800`), because the current code looks the victim up in `player_locations` where it does not exist.

- [ ] **Step 3: Apply the one-line fix**

In `lib/transform.ts`, change line 128 from:

```ts
const enemyLoc = locOf(enemyPuuid);
```

to:

```ts
// On a kill the enemy IS the victim, whose position is the kill location
// (k.location); player_locations never contains the victim. On a death the
// enemy is the alive killer, found in player_locations. Mirrors myLoc above.
const enemyLoc = iKilled ? k.location : locOf(enemyPuuid);
```

- [ ] **Step 4: Update the existing "degrades when player_locations is missing" test**

This test (currently around line 221) uses a _kill_ with no `player_locations`. After the fix, such a kill still loses _my_ position (needs `player_locations`) but now keeps the _enemy_ position (= `k.location`). Replace the test body so the assertions and name match the new, correct behavior:

```ts
it("on a kill, keeps the enemy (kill) location but drops my position without player_locations", () => {
  const legacy = {
    ...detail2,
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
  expect(ld[0].mx).toBeUndefined(); // my position needs player_locations
  expect(ld[0].ex).toBe(5); // enemy = victim, whose position is the kill location
  expect(ld[0].ey).toBe(6);
  expect(ld[0].weapon).toBe("Sheriff");
});
```

- [ ] **Step 5: Make the `detail2` kill fixture realistic**

The `detail2` kill fixture (around line 166) unrealistically lists the victim `foe` in `player_locations`, which masked the bug. Remove that entry so the fixture reflects real v4 data. The existing "captures my kill with positions" test still passes because `ex/ey` now come from `k.location` (also `{ x: 500, y: 600 }`). Change:

```ts
      player_locations: [
        { player: { puuid: "me" }, location: { x: 100, y: 120 } },
        { player: { puuid: "foe" }, location: { x: 500, y: 600 } },
      ],
```

to:

```ts
      // Real v4: the victim (foe) is NOT present; only other alive players.
      player_locations: [{ player: { puuid: "me" }, location: { x: 100, y: 120 } }],
```

- [ ] **Step 6: Run the full transform suite to verify everything passes**

Run: `pnpm exec vitest run tests/transform.test.ts`
Expected: PASS — all tests in the file green, including the new kill-position test, the updated "degrades" test, and the unchanged kill/death position tests.

- [ ] **Step 7: Run the whole unit suite + typecheck to confirm no regressions**

Run: `pnpm exec vitest run && pnpm exec tsc --noEmit`
Expected: PASS — full unit suite green, no TypeScript errors.

- [ ] **Step 8: Commit**

```bash
git add lib/transform.ts tests/transform.test.ts
git commit -m "Fix enemy position extraction for kills"
```

---

### Task 2: Refresh the production snapshot (operator step — run by Kendall)

**Files:**

- Regenerates: `data/snapshot.json`

This task needs live `.env` credentials (HenrikDev `VAL_API_KEY`, Neon `DATABASE_URL`) and must be run by Kendall, not an automated subagent. It does **not** re-fetch match data from HenrikDev — `recapture` re-normalizes already-stored raw match detail with the fixed extraction.

- [ ] **Step 1: Re-normalize all stored match detail**

Run: `pnpm recapture`
Expected: completes without error; reports the number of matches/duels re-normalized.

- [ ] **Step 2: Export the refreshed DB state to the snapshot**

Run: `pnpm sync`
Expected: writes `data/snapshot.json`; duel count with both positions should now be ~100% (vs. ~49% before).

- [ ] **Step 3: Commit the refreshed snapshot**

```bash
git add data/snapshot.json
git commit -m "Recapture duel positions with the fixed extraction"
```

- [ ] **Step 4: Manual verification**

On the FragsMap, hover kill dots and confirm the engagement tracer (your spot → enemy ring) now renders for essentially every duel.

---

## Notes

- Task 1 is the automated, reviewable code change. Task 2 is the operator follow-up that realizes the fix in production data.
- The spatial-zoom redesign and accessible data layer are separate specs/plans built on top of this.
