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

test.describe("Bulk operations", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, "TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD not set");
    await loginAsAdmin(page);
    await page.goto("/assets");
  });

  test("bulk toolbar is hidden initially", async ({ page }) => {
    // Bulk toolbar should not be visible before any selection
    await expect(page.getByText(/selected/i)).not.toBeVisible();
  });

  test("selecting a checkbox shows bulk toolbar", async ({ page }) => {
    const firstCheckbox = page.locator(".asset-row input[type='checkbox']").first();
    await firstCheckbox.click();
    await expect(page.getByText(/1 selected/i)).toBeVisible();
  });

  test("selecting two checkboxes shows correct count", async ({ page }) => {
    const checkboxes = page.locator(".asset-row input[type='checkbox']");
    await checkboxes.nth(0).click();
    await checkboxes.nth(1).click();
    await expect(page.getByText(/2 selected/i)).toBeVisible();
  });

  test("Clear button deselects all and hides toolbar", async ({ page }) => {
    const firstCheckbox = page.locator(".asset-row input[type='checkbox']").first();
    await firstCheckbox.click();
    await expect(page.getByText(/1 selected/i)).toBeVisible();
    await page.getByRole("button", { name: /clear/i }).last().click();
    await expect(page.getByText(/selected/i)).not.toBeVisible();
  });

  test("select all checkbox selects all rows", async ({ page }) => {
    const rowCount = await page.locator(".asset-row").count();
    test.skip(rowCount === 0, "No assets to select");

    // Header checkbox (select all)
    const headerCheckbox = page.locator("input[type='checkbox']").first();
    await headerCheckbox.click();
    await expect(page.getByText(new RegExp(`${rowCount} selected`))).toBeVisible();
  });

  test("Export CSV button is visible in bulk toolbar", async ({ page }) => {
    const firstCheckbox = page.locator(".asset-row input[type='checkbox']").first();
    await firstCheckbox.click();
    await expect(page.getByRole("button", { name: /export csv/i })).toBeVisible();
  });

  test("Change Status button is visible in bulk toolbar", async ({ page }) => {
    const firstCheckbox = page.locator(".asset-row input[type='checkbox']").first();
    await firstCheckbox.click();
    await expect(page.getByRole("button", { name: /change status/i })).toBeVisible();
  });

  test("Change Status opens status dropdown", async ({ page }) => {
    const firstCheckbox = page.locator(".asset-row input[type='checkbox']").first();
    await firstCheckbox.click();
    await page.getByRole("button", { name: /change status/i }).click();
    // At least one status option should appear
    await expect(page.getByText(/In Use|In Storage|Retired/i).first()).toBeVisible();
  });
});
