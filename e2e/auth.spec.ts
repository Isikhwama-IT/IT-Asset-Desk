import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL ?? "";
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD ?? "";

test.describe("Authentication", () => {
  test("redirects unauthenticated user from /assets to /login", async ({ page }) => {
    await page.goto("/assets");
    await expect(page).toHaveURL(/\/login/);
  });

  test("redirects unauthenticated user from /dashboard to /login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("shows error on invalid credentials", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill("invalid@example.com");
    await page.getByLabel(/password/i).fill("wrongpassword");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.getByText(/invalid|incorrect|failed/i)).toBeVisible();
  });

  test("redirects to /dashboard on valid admin login", async ({ page }) => {
    test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, "TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD not set");
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
    await page.getByLabel(/password/i).fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("redirects logged-in user away from /login", async ({ page }) => {
    test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, "TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD not set");
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
    await page.getByLabel(/password/i).fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    // Now navigate to /login again — should redirect away
    await page.goto("/login");
    await expect(page).not.toHaveURL(/\/login/);
  });
});
