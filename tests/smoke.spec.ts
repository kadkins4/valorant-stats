import { test, expect } from "@playwright/test";

// Drive the Regions view on a traced map with data. "All time" guarantees the
// traced map (Ascent) has duels regardless of the current season.
async function gotoRegions(page: import("@playwright/test").Page) {
  await page.goto("/fragsmap");
  await page.getByRole("button", { name: "All time" }).click();
  await page.getByRole("button", { name: "Ascent", exact: true }).click();
  await page.getByRole("button", { name: "Regions" }).click();
}

test("home reveals hero and dashboard", async ({ page }) => {
  await page.goto("/");
  await page.waitForURL("**/home");
  // Final state is reachable regardless of the intro animation. The handle
  // renders in both the reveal overlay and the hero, so scope to the hero
  // (last match, always visible underneath the overlay).
  await expect(page.getByText("ST1CCS").last()).toBeVisible();
  await expect(page.getByText("Current Form")).toBeVisible();
});

test("reduced motion shows dashboard immediately", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/home");
  await expect(page.getByText("Top 3 Agents")).toBeVisible({ timeout: 3000 });
});

test("nav routes resolve", async ({ page }) => {
  for (const path of ["/home", "/track", "/improve", "/fragsmap"]) {
    const res = await page.goto(path);
    expect(res?.status()).toBeLessThan(400);
  }
});

test("fragsmap renders the fight map", async ({ page }) => {
  await page.goto("/fragsmap");
  await expect(page.getByRole("heading", { name: "FragsMap" })).toBeVisible();
  // Filter controls always render regardless of data/remote image load.
  await expect(page.getByRole("button", { name: "Both" })).toBeVisible();
});

test("fragsmap map tiles render and select", async ({ page }) => {
  await page.goto("/fragsmap");
  // Tiles render thumbnail images (text chips had no images).
  await expect(page.locator("button img").first()).toBeVisible();
  // Selecting a map marks its tile pressed (tiles set aria-pressed; chips did not).
  const bind = page.getByRole("button", { name: "Bind", exact: true });
  await expect(bind).toBeVisible();
  await bind.click();
  await expect(bind).toHaveAttribute("aria-pressed", "true");
});

test("region drawing editor renders in dev", async ({ page }) => {
  // The editor is dev-gated; the smoke server runs in development.
  await page.goto("/dev/regions");
  await expect(
    page.getByRole("heading", { name: "Region Editor" }),
  ).toBeVisible();
});

test("region editor enters edit mode with handles and a name field", async ({
  page,
}) => {
  await page.goto("/dev/regions");
  // Ascent loads by default with saved regions; click the first row's Edit.
  await page.getByRole("button", { name: "Edit", exact: true }).first().click();
  // Name field appears, pre-filled.
  await expect(page.getByPlaceholder("Region name…")).toBeVisible();
  // Vertex/midpoint handles render as SVG circles.
  expect(await page.locator("svg circle").count()).toBeGreaterThan(0);
  // Done exits edit mode.
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.getByPlaceholder("Region name…")).toHaveCount(0);
});

test("fragsmap legend explains the muted zones", async ({ page }) => {
  await page.goto("/fragsmap");
  // The legend renders under the map on initial load (grid view).
  await expect(page.getByText(/under 4 duels/i)).toBeVisible();
});

test("fragsmap region detail shows enriched stats", async ({ page }) => {
  await gotoRegions(page);
  // Selecting a zone opens the enriched panel.
  await page.waitForLoadState("networkidle");
  // SVG polygons need dispatchEvent to reliably fire React's synthetic onClick.
  await page.locator("svg polygon").first().dispatchEvent("click");
  await expect(page.getByText("win rate")).toBeVisible();
  await expect(page.getByText(/^\d+ duels$/).first()).toBeVisible();
});

test("fragsmap region hover shows a tooltip", async ({ page }) => {
  await gotoRegions(page);
  await page.waitForLoadState("networkidle");
  // SVG polygons need dispatchEvent to reliably fire React's synthetic
  // onMouseMove (mirrors the click handling in the detail test above).
  await page.locator("svg polygon").first().dispatchEvent("mousemove");
  await expect(page.getByRole("tooltip")).toBeVisible();
});

test("dev region issues page renders", async ({ page }) => {
  // Dev-gated; the smoke server runs in development.
  await page.goto("/dev/issues");
  await expect(
    page.getByRole("heading", { name: "Region issues" }),
  ).toBeVisible();
});

test("fragsmap shows a non-critical region-issue notice", async ({ page }) => {
  // Ascent all-time almost always has frags that fall between/over zones.
  // (If a future trace fully tiles Ascent, swap to another map that /dev/issues
  // reports as having issues.)
  await gotoRegions(page);
  const notice = page.getByRole("status");
  await expect(notice).toBeVisible();
  // Dismiss hides it.
  await notice.getByRole("button", { name: "Dismiss" }).click();
  await expect(notice).toBeHidden();
});

test("overlapping duels cluster into a badge that fans out and opens details", async ({
  page,
}) => {
  await gotoRegions(page);
  await page.waitForLoadState("networkidle");
  const polys = page.locator("svg polygon");
  const n = await polys.count();
  // Open regions until one shows a cluster badge (gold-stroked circle in the detail).
  let opened = false;
  for (let i = 0; i < n; i++) {
    await polys.nth(i).dispatchEvent("click");
    const badge = page.locator('svg circle[fill="#161b26"][stroke="#ffd166"]');
    if ((await badge.count()) > 0) {
      const dotsBefore = await page.locator("svg [data-duel]").count();
      await badge.first().dispatchEvent("click");
      // Fan revealed at least one selectable duel dot.
      const dots = page.locator("svg [data-duel]");
      await expect(dots.first()).toBeVisible();
      expect(await dots.count()).toBeGreaterThanOrEqual(dotsBefore);
      // Click a fanned dot → details dialog opens, then closes.
      await dots.last().dispatchEvent("click");
      await expect(page.getByText(/^(KILL|DEATH)$/).first()).toBeVisible();
      await page.getByRole("button", { name: "Close" }).click();
      await expect(page.getByText(/^(KILL|DEATH)$/)).toHaveCount(0);
      opened = true;
      break;
    }
  }
  expect(opened).toBe(true);
});

test("clicking a duel dot opens and closes the focus dialog", async ({
  page,
}) => {
  await gotoRegions(page);
  await page.waitForLoadState("networkidle");
  // Open a region's detail (its duel dots). SVG polygons need dispatchEvent to
  // reliably fire React's synthetic onClick.
  await page.locator("svg polygon").first().dispatchEvent("click");
  // If all dots in this region are clustered, expand the first badge so
  // individual duel dots become visible before we try to click one.
  const badge = page.locator('svg circle[fill="#161b26"][stroke="#ffd166"]');
  if ((await badge.count()) > 0) {
    await badge.first().dispatchEvent("click");
  }
  // Click a duel dot. Use [data-duel] — stable regardless of fill color.
  // Use last() — last dot is a stable target.
  const dot = page.locator("svg [data-duel]").last();
  // Color-independent encoding: deaths render as ✕ (lines), not circles.
  const deaths = page.locator('svg [data-duel="death"]');
  if ((await deaths.count()) > 0) {
    await expect(deaths.first().locator("line").first()).toBeAttached();
  }
  await dot.dispatchEvent("click");
  // Dialog shows the always-present outcome chip.
  await expect(page.getByText(/^(KILL|DEATH)$/).first()).toBeVisible();
  // Close via the real button (.click() — it's a standard DOM button).
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByText(/^(KILL|DEATH)$/)).toHaveCount(0);
});
