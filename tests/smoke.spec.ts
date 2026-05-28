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
