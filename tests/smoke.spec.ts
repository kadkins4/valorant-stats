import { test, expect } from "@playwright/test";

test("splash redirects to home and widgets render", async ({ page }) => {
  await page.goto("/");
  await page.waitForURL("**/home");
  await expect(page.getByText("Current Form")).toBeVisible();
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

test("region drawing editor renders in dev", async ({ page }) => {
  // The editor is dev-gated; the smoke server runs in development.
  await page.goto("/dev/regions");
  await expect(
    page.getByRole("heading", { name: "Region Editor" }),
  ).toBeVisible();
});
