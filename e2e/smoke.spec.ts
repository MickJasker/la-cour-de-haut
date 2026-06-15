import { test, expect } from "@playwright/test";

test("smoke: homepage redirects to /nl and shows heading", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/nl/);
  await expect(
    page.getByRole("heading", { level: 1, name: /La Cour de Haut/i }),
  ).toBeVisible();
});
