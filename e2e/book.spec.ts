import { test, expect } from "@playwright/test";

test.describe("booking dialog — intercepting route", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/nl");
  });

  test("clicking 'Book now' in the header opens the dialog without leaving the page", async ({
    page,
  }) => {
    await page.getByRole("banner").locator("a[href$='/book']").click();

    // The intercepting route is pre-compiled by warmup.setup.ts, so the dialog
    // appears promptly. Once it's visible the URL has already updated.
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page).toHaveURL(/\/nl\/book/);
    // h1 uses display:contents so it has no box — toBeAttached confirms the home
    // page is still rendered underneath (intercepted, not replaced)
    await expect(page.locator("h1")).toBeAttached();
  });

  test("clicking 'Book now' in the hero opens the dialog", async ({ page }) => {
    // Exact name: /boek/i substring-matches POI cards containing "bezoek"
    await page
      .getByRole("main")
      .getByRole("link", { name: "Boek je verblijf nu" })
      .click();

    await expect(page).toHaveURL(/\/nl\/book/);
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("Escape closes the dialog and returns to the previous page", async ({
    page,
  }) => {
    await page.getByRole("banner").locator("a[href$='/book']").click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(page).toHaveURL(/\/nl$/);
  });

  test("close button dismisses the dialog", async ({ page }) => {
    await page.getByRole("banner").locator("a[href$='/book']").click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.getByRole("button", { name: /close/i }).click();

    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(page).toHaveURL(/\/nl$/);
  });

  test("the privacy link opens in a new tab and keeps the dialog and form state intact", async ({
    page,
  }) => {
    await page.getByRole("banner").locator("a[href$='/book']").click();
    await expect(page.getByRole("dialog")).toBeVisible();

    // Fill a field so we can assert form state survives the click
    await page.locator("#name").fill("Jan Jansen");

    // The privacy link sits below the form, inside the dialog
    const popupPromise = page.waitForEvent("popup");
    await page.getByRole("dialog").locator("a[href$='/privacy']").click();
    const popup = await popupPromise;

    // Policy opens in a new tab; the booking flow is untouched behind it
    await expect(popup).toHaveURL(/\/nl\/privacy/);
    await expect(page).toHaveURL(/\/nl\/book/);
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.locator("#name")).toHaveValue("Jan Jansen");
  });

  test("clicking the overlay closes the dialog", async ({ page }) => {
    await page.getByRole("banner").locator("a[href$='/book']").click();
    await expect(page.getByRole("dialog")).toBeVisible();

    // Click the top-left corner of the viewport — outside the dialog panel
    await page.mouse.click(10, 10);

    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(page).toHaveURL(/\/nl$/);
  });
});

test.describe("booking page — direct navigation (hard refresh)", () => {
  test("navigating directly to /nl/book renders the standalone page, not a dialog", async ({
    page,
  }) => {
    await page.goto("/nl/book");

    await expect(page).toHaveURL(/\/nl\/book/);
    // No dialog overlay
    await expect(page.getByRole("dialog")).not.toBeVisible();
    // Hero is not present — this is a different page
    await expect(page.getByRole("heading", { level: 1 })).not.toBeVisible();
  });

  test("locale switching works on the standalone book page", async ({
    page,
  }) => {
    await page.goto("/nl/book");
    await expect(page).toHaveURL(/\/nl\/book/);

    await page.goto("/fr/book");
    await expect(page).toHaveURL(/\/fr\/book/);
    await expect(page.getByRole("dialog")).not.toBeVisible();
  });
});

test.describe("booking dialog — locale variants", () => {
  for (const locale of ["nl", "en", "fr", "de"]) {
    test(`dialog opens correctly on /${locale}`, async ({ page }) => {
      await page.goto(`/${locale}`);
      // Locate the header CTA by its /book href, not its per-locale label
      // (nl "Reserveer nu", en "Book now", etc.) — the href is stable across
      // locales and copy edits.
      await page.getByRole("banner").locator("a[href$='/book']").click();

      await expect(page).toHaveURL(new RegExp(`\\/${locale}\\/book`));
      await expect(page.getByRole("dialog")).toBeVisible();

      await page.keyboard.press("Escape");
      await expect(page).toHaveURL(new RegExp(`\\/${locale}$`));
    });
  }
});
