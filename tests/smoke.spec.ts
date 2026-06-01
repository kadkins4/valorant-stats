import { test, expect } from "@playwright/test";

test("splash redirects to home and widgets render", async ({ page }) => {
  await page.goto("/");
  await page.waitForURL("**/home");
  await expect(page.getByText("Current Form")).toBeVisible();
});

test("nav routes resolve", async ({ page }) => {
  for (const path of ["/home", "/track", "/improve", "/showcase"]) {
    const res = await page.goto(path);
    expect(res?.status()).toBeLessThan(400);
  }
});

test("showcase renders the fight map", async ({ page }) => {
  await page.goto("/showcase");
  await expect(page.getByRole("heading", { name: "Fight Map" })).toBeVisible();
  // Filter controls always render regardless of data/remote image load.
  await expect(page.getByRole("button", { name: "Both" })).toBeVisible();
});
