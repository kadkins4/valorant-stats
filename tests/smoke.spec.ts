import { test, expect } from "@playwright/test";

// Drive a traced map with data. "All time" guarantees the traced map (Ascent)
// has duels regardless of the current season. Dots is the default layer.
async function gotoAscent(page: import("@playwright/test").Page) {
  await page.goto("/fragsmap");
  await page.getByRole("button", { name: "All time" }).click();
  await page.getByRole("button", { name: "Ascent", exact: true }).click();
  await page.waitForLoadState("networkidle");
}

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

test("nav disables Track and Improve as 'Soon'", async ({ page }) => {
  await page.goto("/home");
  // Live tabs are links.
  await expect(page.getByRole("link", { name: "Home" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "FragsMap", exact: true }),
  ).toBeVisible();
  // Disabled tabs are not links and are marked Soon. Scope to the nav so we
  // don't match the hero's "Track →" button or its "coming soon" label.
  const nav = page.locator("nav");
  await expect(page.getByRole("link", { name: "Track" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Improve" })).toHaveCount(0);
  await expect(nav.getByText("Track")).toBeVisible();
  await expect(nav.getByText("Improve")).toBeVisible();
  await expect(nav.getByText("Soon", { exact: true })).toHaveCount(2);
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
  // The legend renders under the map on initial load (default dots view).
  await expect(page.getByText(/under 4 duels/i)).toBeVisible();
});

test("clicking a heatmap region zooms in", async ({ page }) => {
  await gotoAscent(page);
  await page.getByRole("button", { name: "Heatmap" }).click();
  // Click polygons until one triggers a zoom (some regions may have no duels).
  const polys = page.locator("svg polygon");
  const n = await polys.count();
  let zoomed = false;
  for (let i = 0; i < n; i++) {
    await polys.nth(i).dispatchEvent("click");
    const crumb = page.getByRole("button", { name: /All regions/ });
    if (await crumb.isVisible()) {
      zoomed = true;
      break;
    }
  }
  expect(zoomed).toBe(true);
});

test("heatmap region hover shows a tooltip", async ({ page }) => {
  await gotoAscent(page);
  await page.getByRole("button", { name: "Heatmap" }).click();
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
  await gotoAscent(page);
  const notice = page.getByRole("status");
  await expect(notice).toBeVisible();
  await notice.getByRole("button", { name: "Dismiss" }).click();
  await expect(notice).toBeHidden();
});

test("inside a zoom, an overlapping cluster fans out and opens details", async ({
  page,
}) => {
  await gotoAscent(page);
  await page.getByRole("button", { name: "Heatmap" }).click();
  const polys = page.locator("svg polygon");
  const n = await polys.count();
  let opened = false;
  for (let i = 0; i < n; i++) {
    await polys.nth(i).dispatchEvent("click");
    const badge = page.locator('svg circle[fill="#161b26"][stroke="#ffd166"]');
    if ((await badge.count()) > 0) {
      await badge.first().dispatchEvent("click");
      const dots = page.locator("svg [data-duel]");
      await expect(dots.first()).toBeVisible();
      await dots.last().dispatchEvent("click");
      await expect(page.getByText(/^(KILL|DEATH)$/).first()).toBeVisible();
      await page.getByRole("button", { name: "Close" }).click();
      await expect(page.getByText(/^(KILL|DEATH)$/)).toHaveCount(0);
      opened = true;
      break;
    }
    await page.getByRole("button", { name: /All regions/ }).click();
    await expect(page.getByRole("button", { name: /All regions/ })).toHaveCount(
      0,
    );
    await page.getByRole("button", { name: "Heatmap" }).click();
  }
  expect(opened).toBe(true);
});

test("FragsMap filter controls expose pressed state", async ({ page }) => {
  await gotoAscent(page);
  await expect(page.getByRole("button", { name: "Dots" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("button", { name: "Heatmap" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(
    page
      .getByRole("group", { name: "Side" })
      .getByRole("button", { name: "Both" }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("reduced motion snaps the dots-layer zoom instantly", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await gotoAscent(page); // dots layer is the default
  // Clicking a duel dot zooms via the animation hook; reduced motion must snap.
  await page.locator("svg [data-duel]").first().dispatchEvent("click");
  await expect(page.getByRole("button", { name: /All regions/ })).toBeVisible();
  // Under reduced motion the hook bypasses rAF, so the viewBox is already the
  // settled (non-full) region box rather than the full map.
  const vb = await page.locator("svg").last().getAttribute("viewBox");
  expect(vb).not.toBe("0 0 100 100");
});

test("zooming into a region then clicking a dot opens the focus dialog", async ({
  page,
}) => {
  await gotoAscent(page);
  await page.locator("svg [data-duel]").first().dispatchEvent("click");
  const crumb = page.getByRole("button", { name: /All regions/ });
  await expect(crumb).toBeVisible();
  const badge = page.locator('svg circle[fill="#161b26"][stroke="#ffd166"]');
  if ((await badge.count()) > 0) {
    await badge.first().dispatchEvent("click");
  }
  await page.locator("svg [data-duel]").last().dispatchEvent("click");
  await expect(page.getByText(/^(KILL|DEATH)$/).first()).toBeVisible();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("button", { name: "Close" })).toBeFocused();
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByText(/^(KILL|DEATH)$/)).toHaveCount(0);
  await crumb.click();
  await expect(page.getByRole("button", { name: /All regions/ })).toHaveCount(
    0,
  );
});

test("region breakdown table zooms into a region", async ({ page }) => {
  await gotoAscent(page); // dots overview by default
  const row = page
    .getByRole("button", { name: /\d+ duels, \d+% win rate/ })
    .first();
  await expect(row).toBeVisible();
  await row.click();
  await expect(page.getByRole("button", { name: /All regions/ })).toBeVisible();
});

test("zoomed breakdown lists duels and activating one opens the dialog with aria-current", async ({
  page,
}) => {
  await gotoAscent(page);
  await page
    .getByRole("button", { name: /\d+ duels, \d+% win rate/ })
    .first()
    .click();
  await expect(page.getByRole("button", { name: /All regions/ })).toBeVisible();
  const duelRow = page.getByRole("button", { name: /^(Kill|Death),/ }).first();
  await expect(duelRow).toBeVisible();
  await duelRow.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator('tr[aria-current="true"]')).toHaveCount(1);
});

test("clicking a dot marks the matching breakdown row aria-current", async ({
  page,
}) => {
  await gotoAscent(page);
  await page
    .getByRole("button", { name: /\d+ duels, \d+% win rate/ })
    .first()
    .click();
  await expect(page.getByRole("button", { name: /All regions/ })).toBeVisible();
  // The region's duels may render as a cluster badge; fan it out first (same
  // pattern as the existing focus-dialog test) so an individual dot is clickable.
  const badge = page.locator('svg circle[fill="#161b26"][stroke="#ffd166"]');
  if ((await badge.count()) > 0) {
    await badge.first().dispatchEvent("click");
  }
  await page.locator("svg [data-duel]").first().dispatchEvent("click");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator('tr[aria-current="true"]')).toHaveCount(1);
});

test("the decorative map svg is hidden from assistive tech", async ({
  page,
}) => {
  await gotoAscent(page);
  // Target the map SVG specifically (width="100%" distinguishes it from
  // fixed-size icon SVGs and the Next.js dev overlay).
  await expect(page.locator('svg[width="100%"]').last()).toHaveAttribute(
    "aria-hidden",
    "true",
  );
});

test("opening-duel chip renders and the Openers filter thins the map", async ({
  page,
}) => {
  await gotoAscent(page);
  // The headline chip is present whenever the selected map has opening duels.
  // Exact + case-sensitive so it matches the chip span, not the "OPENING DUELS"
  // control-group label.
  await expect(page.getByText("Opening duels", { exact: true })).toBeVisible();

  const allDuels = await page.locator("svg [data-duel]").count();
  await page.getByRole("button", { name: "Openers", exact: true }).click();
  await page.waitForLoadState("networkidle");
  // Openers are a subset, so the visible dot count must not grow.
  await expect
    .poll(async () => page.locator("svg [data-duel]").count())
    .toBeLessThanOrEqual(allDuels);
});
