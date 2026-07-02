import { test, expect } from "@playwright/test";

// Regression for the two-shells bug: switching locale from the header must
// leave exactly ONE page shell mounted. Each locale is its own root layout
// (`[locale]/layout.tsx` renders its own <html>/<body> — ADR-0011), so a
// soft client navigation between locales cannot swap the root layout and
// instead parks the previous locale's whole tree in a hidden `<Activity>`
// boundary (`display: none !important`). That leaves a duplicate <main>,
// <header>, <footer>, and duplicate DOM ids behind the visible page.
//
// This only manifests under the production build, where PPR/Activity
// retention actually runs — never under `next dev` (ADR-0009) — so it lives
// in the Playwright suite, which CI runs against `next build && next start`.
test.describe("header locale switch", () => {
  test("leaves exactly one page shell (no stale hidden duplicate)", async ({
    page,
  }) => {
    await page.goto("/nl");
    await expect(page.locator("body > main")).toHaveCount(1);

    // Switch nl -> en via the header language control.
    await page.getByRole("link", { name: "Switch to English" }).click();
    await expect(page).toHaveURL(/\/en$/);

    // The old /nl shell must be gone, not merely hidden.
    await expect(page.locator("body > main")).toHaveCount(1);
    await expect(page.locator("body > header")).toHaveCount(1);
    await expect(page.locator("body > main")).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });

  test("stays single-shelled across repeated switches", async ({ page }) => {
    await page.goto("/nl");
    for (const label of ["Switch to English", "Switch to Français"]) {
      await page.getByRole("link", { name: label }).click();
      // A stale hidden shell would keep its own header, so the switcher would
      // match twice and this click would hit a strict-mode violation.
      await expect(page.locator("body > main")).toHaveCount(1);
    }
  });
});
