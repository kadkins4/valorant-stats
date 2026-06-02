import { test, expect } from "@playwright/test";

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
