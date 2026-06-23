import { test, expect, type Page } from "@playwright/test";
import { neon } from "@neondatabase/serverless";

const PLACEHOLDER_URL = "https://picsum.photos/seed/test/800/600";

async function clearGallery() {
  const sql = neon(process.env.DATABASE_URL!);
  await sql`TRUNCATE gallery_image`;
}

// GiteSection uses `'use cache'` (tag "gallery"), and that cache is shared
// process-wide across Playwright workers. Tests seed the DB directly — outside
// the Server Actions that would normally call `updateTag` — so we expire the tag
// *after* seeding and immediately before navigating. Busting post-seed (rather
// than in beforeEach) closes the race where a concurrent render (e.g. smoke.spec
// hitting "/") caches the pre-seed empty table.
async function gotoFresh(page: Page, path: string) {
  await fetch("http://localhost:3000/api/dev/revalidate-gallery", {
    method: "POST",
  });
  await page.goto(path);
}

async function seedImage(opts: {
  id: string;
  imageUrl?: string;
  sortOrder: number;
  published: boolean;
}) {
  const sql = neon(process.env.DATABASE_URL!);
  await sql`
    INSERT INTO gallery_image (id, image_url, sort_order, published, created_at)
    VALUES (
      ${opts.id},
      ${opts.imageUrl ?? PLACEHOLDER_URL},
      ${opts.sortOrder},
      ${opts.published},
      now()
    )
  `;
}

test.describe("gallery: public section", () => {
  test.beforeEach(clearGallery);
  test.afterEach(clearGallery);

  test("published image appears in the Gîte section on the homepage", async ({
    page,
  }) => {
    await seedImage({ id: "gal-test-1", sortOrder: 1, published: true });
    await gotoFresh(page, "/nl");
    const section = page.locator("[data-testid='gite-section']");
    await expect(section).toBeVisible();
    await expect(section.locator("img")).toHaveCount(1);
  });

  test("unpublished image is not shown on the public page", async ({
    page,
  }) => {
    await seedImage({ id: "gal-test-pub", sortOrder: 1, published: true });
    await seedImage({ id: "gal-test-priv", sortOrder: 2, published: false });
    await gotoFresh(page, "/nl");
    const section = page.locator("[data-testid='gite-section']");
    await expect(section.locator("img")).toHaveCount(1);
  });

  test("at most 4 images shown in the inline grid", async ({ page }) => {
    for (let i = 1; i <= 6; i++) {
      await seedImage({ id: `gal-test-${i}`, sortOrder: i, published: true });
    }
    await gotoFresh(page, "/nl");
    const section = page.locator("[data-testid='gite-section']");
    await expect(section.locator("[data-testid='gite-grid'] img")).toHaveCount(
      4,
    );
  });

  test("section title appears in Dutch", async ({ page }) => {
    await seedImage({ id: "gal-test-nl", sortOrder: 1, published: true });
    await gotoFresh(page, "/nl");
    await expect(page.getByRole("heading", { name: /De Gîte/i })).toBeVisible();
  });

  test("section title appears in English", async ({ page }) => {
    await seedImage({ id: "gal-test-en", sortOrder: 1, published: true });
    await gotoFresh(page, "/en");
    await expect(
      page.getByRole("heading", { name: /The Gîte/i }),
    ).toBeVisible();
  });

  test("section title appears in French", async ({ page }) => {
    await seedImage({ id: "gal-test-fr", sortOrder: 1, published: true });
    await gotoFresh(page, "/fr");
    await expect(page.getByRole("heading", { name: /La Gîte/i })).toBeVisible();
  });

  test("section title appears in German", async ({ page }) => {
    await seedImage({ id: "gal-test-de", sortOrder: 1, published: true });
    await gotoFresh(page, "/de");
    await expect(
      page.getByRole("heading", { name: /Das Gîte/i }),
    ).toBeVisible();
  });

  test("'Bekijk meer foto's' button opens dialog showing all published photos", async ({
    page,
  }) => {
    for (let i = 1; i <= 6; i++) {
      await seedImage({ id: `gal-dlg-${i}`, sortOrder: i, published: true });
    }
    await gotoFresh(page, "/nl");
    // `.click()` (not `dispatchEvent`) so Playwright waits for the GiteDialog
    // client component to hydrate — under PPR the static shell streams first,
    // so a raw dispatched event can fire before React attaches its handler.
    await page.getByRole("button", { name: /bekijk meer foto/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("img")).toHaveCount(6);
  });
});

test.describe("gallery: admin", () => {
  test.use({ storageState: "e2e/.auth/owner.json" });

  test.beforeEach(clearGallery);
  test.afterEach(clearGallery);

  test("gallery page is accessible in the admin sidebar", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByRole("link", { name: /gallery/i })).toBeVisible();
  });

  test("owner can upload an image and it appears in the gallery list", async ({
    page,
  }) => {
    await page.goto("/admin/gallery");
    const fileInput = page.locator("input[type='file']");
    await fileInput.setInputFiles({
      name: "test-photo.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from(
        "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8U" +
          "HRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgN" +
          "DRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIy" +
          "MjL/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAA" +
          "AAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/" +
          "aAAwDAQACEQMRAD8AJQAB/9k=",
        "base64",
      ),
    });
    await page.getByRole("button", { name: /upload/i }).click();
    await expect(page.locator("[data-testid='gallery-list'] img")).toHaveCount(
      1,
    );
  });

  test("owner can toggle published status", async ({ page }) => {
    await seedImage({ id: "gal-admin-toggle", sortOrder: 1, published: false });
    await page.goto("/admin/gallery");
    const row = page.locator("[data-testid='gallery-row-gal-admin-toggle']");
    await row.getByRole("checkbox", { name: /published/i }).check();
    await expect(
      row.getByRole("checkbox", { name: /published/i }),
    ).toBeChecked();
  });

  test("owner can delete an image", async ({ page }) => {
    await seedImage({ id: "gal-admin-del", sortOrder: 1, published: false });
    await page.goto("/admin/gallery");
    await expect(
      page.locator("[data-testid='gallery-row-gal-admin-del']"),
    ).toBeVisible();
    await page
      .locator("[data-testid='gallery-row-gal-admin-del']")
      .getByRole("button", { name: /delete/i })
      .click();
    await expect(
      page.locator("[data-testid='gallery-row-gal-admin-del']"),
    ).not.toBeVisible();
  });
});
