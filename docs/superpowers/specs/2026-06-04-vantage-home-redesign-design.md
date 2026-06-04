# Vantage — Nav cleanup + Home page redesign

**Date:** 2026-06-04
**Status:** Approved (design)
**Author:** Kenny (with Claude)

## Context

Vantage is a Next.js VALORANT performance-analytics app. Real visitors are coming
soon and the app is **portfolio-first** — the audience is recruiters, peers, and
people Kenny shares the link with, not (primarily) gamers using the tool.

Two problems:

1. The nav exposes **Track** and **Improve**. Improve is an empty "coming soon"
   placeholder; Track has working charts but is not part of the current focus
   (FragsMap is the showcase). Both should be visibly de-emphasized.
2. The home page drops a cold visitor straight into a single player's gamertag
   stats (`ST1CCS#STONE · RADIANT`) with no explanation of what Vantage is. It
   doesn't say what the product does and doesn't make a strong first impression.

The focus is **FragsMap** (spatial kill/death map). The home page's job is:
say what Vantage is, look sharp, and funnel visitors into FragsMap.

## Decisions (validated via visual brainstorming)

- **Layout:** "Product Landing" (centered hero, product-first).
- **Agent art:** feature a Valorant agent splash, treated to feel native.
  - Treatment: **red duotone** (recolored toward the brand accent).
  - Agent: **dynamic** — the player's most-played agent.
- **Reveal overlay:** **drop** the full-screen `HomeReveal` (gates the value prop
  behind a ~1s curtain and spotlights a meaningless-to-visitors gamertag).
- **Motion:** numbers should animate (subtle count-up) so the page "feels alive,"
  applied consistently to hero stats _and_ card numbers, respecting
  `prefers-reduced-motion`.
- **Footer:** add a portfolio backlink (Kenny's standard `utm_source=vantage`).

## Design

### 1. Nav (`components/Nav.tsx`)

- Live, clickable tabs: **Home**, **FragsMap**.
- **Track** and **Improve** render as disabled items: non-clickable `<span>`
  (not `<Link>`), muted color, with a small **"Soon"** badge. Add
  `aria-disabled="true"`. Pages and their code stay in the repo — only the nav
  links are removed.
- Keep the existing `RefreshBadge`.

### 2. Home hero — Product Landing (`app/home/page.tsx` + `components/home/Hero.tsx`)

Left-aligned hero content over the agent splash:

- **Eyebrow:** `Spatial VALORANT analytics` (red, uppercase, letter-spaced).
- **Wordmark (H1):** `VAN` (text color) + `TAGE` (accent red), large
  `clamp()` size.
- **Pitch (one line):** "Every kill and death from your ranked matches, plotted
  on the map — see exactly where you win, and where you don't."
- **Primary CTA:** **Explore FragsMap →** linking to `/fragsmap` (styled button,
  accent background).
- **Quick stats (inline):** Win % · K/D · Matches, sourced from real data
  (`currentForm` / match count), each animated via the shared count-up.

`Hero.tsx` is reworked from the current player-handle hero into this layout.

### 3. Agent splash (`components/home/AgentSplash.tsx` — new, client)

- Input: a portrait URL (resolved server-side from the most-played agent).
- Renders the full-portrait PNG positioned full-height, bleeding from the right,
  `mask-image` linear-gradient fade into the background on the left, plus a faint
  radial red glow tying it to the accent.
- **Red duotone** via CSS `filter` (grayscale + sepia + hue-rotate toward accent
  - saturate/brightness tuning). Tune to match `--accent` (#ff4655).
- **Graceful fallback:** if there is no match data or the agent isn't in the
  portrait map, render the hero with no splash (no broken image, layout intact).

### 4. Agent portrait mapping (`lib/agents/portraits.json` + generator script)

- Agent match data stores clean display names (`Astra`, `Jett`, …) that match
  valorant-api's `displayName`. `byAgent(ms)[0].agent` is the most-played agent.
- Add `scripts/fetch-agent-portraits.ts` (mirrors `scripts/fetch-map-calibration.ts`):
  fetches `https://valorant-api.com/v1/agents?isPlayableCharacter=true` and writes
  `lib/agents/portraits.json` mapping `displayName` → `fullPortrait` URL on
  `media.valorant-api.com` (same host the maps already use; no external call at
  render time).
- `app/home/page.tsx` looks up the top agent's portrait from this map and passes
  the URL to `AgentSplash`.

### 5. Credibility strip (below hero)

- Keep the existing four `StatCard`s (Top Agents, Best/Worst Map, Top Gun,
  Current Form) under a small label such as **"Built on real ranked data."**
- Numeric values in the cards animate via the shared count-up (subtle).

### 6. Motion (`components/home/CountUp.tsx` — generalized from `useCountUp`)

- Extract the existing `useCountUp` logic from `Hero.tsx` into one reusable
  hook/component used by both the hero quick stats and the card numbers.
- Subtle: ~1s ease-out, integers and fixed-decimals supported.
- Respect `prefers-reduced-motion: reduce` → render final value immediately
  (existing behavior preserved).
- Keep the staggered card fade-in entrance (`home.module.css`, `cardEnter`).

### 7. Footer — already satisfied (no work)

- `app/layout.tsx` already renders a global footer on every page:
  `← Built by Kendall Adkins` → `https://kendalladkins.dev/?utm_source=valorant`.
  This already covers the portfolio backlink requirement, so no footer changes
  are needed. (Keep the existing `utm_source=valorant` tag rather than
  introducing a new one.)

### 8. Remove the reveal overlay

- Stop rendering `HomeReveal` in `app/home/page.tsx`. The component file and
  `lib/home/reveal.ts` may remain unused for now (cleanup optional), but the
  overlay no longer wraps the page. First paint is the value prop.

## Components touched

| File                               | Change                                                              |
| ---------------------------------- | ------------------------------------------------------------------- |
| `components/Nav.tsx`               | Track/Improve → disabled "Soon" spans                               |
| `app/home/page.tsx`                | Layout A composition; resolve top-agent portrait; drop `HomeReveal` |
| `components/home/Hero.tsx`         | Rework to product-landing hero                                      |
| `components/home/AgentSplash.tsx`  | **new** — duotone, edge-faded agent splash                          |
| `components/home/CountUp.tsx`      | **new** — reusable count-up component                               |
| `lib/home/countup.ts`              | **new** — pure count-up easing/format helpers (unit-tested)         |
| `lib/agents/portraits.ts`          | **new** — `agentPortrait()` lookup (unit-tested)                    |
| `lib/agents/portraits.json`        | **new** — agent displayName → portrait URL (generated, committed)   |
| `scripts/fetch-agent-portraits.ts` | **new** — generator (mirrors map-calibration script)                |
| `components/home/home.module.css`  | hero / splash styles                                                |
| `tests/smoke.spec.ts`              | update home assertions (wordmark/CTA); add nav "Soon" check         |

Note: `app/layout.tsx` footer is unchanged (already provides the portfolio
backlink). `StatCard.tsx` needs no change — it already renders `ReactNode`
children, so animated numbers are passed in as `<CountUp>` elements.

## Out of scope

- Building out the Track / Improve pages (kept, just unlinked).
- FragsMap changes.
- Any redesign beyond the home page and nav.

## Success criteria

- A cold visitor immediately understands what Vantage is and what FragsMap does.
- Home looks polished and on-brand (dark UI, red accent, agent splash feels native).
- One clear CTA funnels to `/fragsmap`.
- Numbers animate subtly; motion is disabled under `prefers-reduced-motion`.
- Track/Improve are visibly "Soon" and not reachable from the nav.
- No broken state when data or an agent portrait is missing.
