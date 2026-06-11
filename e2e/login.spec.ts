import { test, expect } from "@playwright/test";
import path from "path";

const authFile = path.join(__dirname, ".auth/owner.json");

test("unauthenticated visit to /admin redirects to /admin/login", async ({
  page,
}) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login/);
});

test("invalid credentials show error and stay on login page", async ({
  page,
}) => {
  await page.goto("/admin/login");
  await page.fill('input[type="email"]', "wrong@example.com");
  await page.fill('input[type="password"]', "wrongpassword");
  await page.click('button[type="submit"]');
  await expect(page.locator('[role="alert"]')).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/login/);
});

test("valid credentials redirect to /admin", async ({ page }) => {
  const email = process.env.OWNER_EMAIL!;
  const password = process.env.OWNER_PASSWORD!;
  await page.goto("/admin/login");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/admin$/);
});

test.describe("authenticated", () => {
  test.use({ storageState: authFile });

  test("/admin/login redirects to /admin when already authenticated", async ({
    page,
  }) => {
    await page.goto("/admin/login");
    await expect(page).toHaveURL(/\/admin$/);
  });
});
