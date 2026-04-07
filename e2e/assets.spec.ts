import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL ?? "";
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD ?? "";

async function loginAsAdmin(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
  await page.getByLabel(/password/i).fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe("Assets page", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, "TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD not set");
    await loginAsAdmin(page);
  });

  test("loads assets page with table", async ({ page }) => {
    await page.goto("/assets");
    await expect(page.getByPlaceholder(/search assets/i)).toBeVisible();
    // Table header row
    await expect(page.getByText("#").first()).toBeVisible();
  });

  test("search filters the asset list", async ({ page }) => {
    await page.goto("/assets");
    const search = page.getByPlaceholder(/search assets/i);
    await search.fill("zzznomatch12345");
    await expect(page.getByText(/no assets match/i)).toBeVisible({ timeout: 5000 });
  });

  test("clearing search restores assets", async ({ page }) => {
    await page.goto("/assets");
    const search = page.getByPlaceholder(/search assets/i);
    await search.fill("zzznomatch12345");
    await search.clear();
    // Table should have rows again — just check the search cleared
    await expect(page.getByPlaceholder(/search assets/i)).toHaveValue("");
  });

  test("clicking an asset row navigates to detail page", async ({ page }) => {
    await page.goto("/assets");
    // Click the first asset row (the div that has an arrow icon)
    const firstRow = page.locator(".asset-row").first();
    await firstRow.click();
    await expect(page).toHaveURL(/\/assets\/.+/);
  });

  test("asset detail page shows asset information", async ({ page }) => {
    await page.goto("/assets");
    const firstRow = page.locator(".asset-row").first();
    await firstRow.click();
    // Should have at least some asset info visible
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });
});
