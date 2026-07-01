import { test, expect, type Page } from "@playwright/test";
import { neon } from "@neondatabase/serverless";
import zlib from "node:zlib";

const PLACEHOLDER_URL = "https://picsum.photos/seed/test/800/600";

// Builds a minimal, valid, uncompressed-scanline PNG buffer of the given
// pixel dimensions (8-bit truecolor RGB, no filter, no interlace) — enough
// for a browser's createImageBitmap()/next/image to decode and report real
// naturalWidth/naturalHeight. Used by the aspect-ratio e2e test below to
// produce two real uploadable images of known, distinct dimensions without
// hardcoding opaque base64 blobs.
function pngChunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(zlib.crc32(Buffer.concat([typeBuf, data])) >>> 0, 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function makePng(
  width: number,
  height: number,
  rgb: [number, number, number],
): Buffer {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 2; // color type: truecolor RGB
  ihdrData[10] = 0; // compression method
  ihdrData[11] = 0; // filter method
  ihdrData[12] = 0; // interlace method
  const ihdr = pngChunk("IHDR", ihdrData);

  const rowBytes = 1 + width * 3;
  const raw = Buffer.alloc(rowBytes * height);
  for (let y = 0; y < height; y++) {
    const offset = y * rowBytes;
    raw[offset] = 0; // per-scanline filter type: none
    for (let x = 0; x < width; x++) {
      const p = offset + 1 + x * 3;
      raw[p] = rgb[0];
      raw[p + 1] = rgb[1];
      raw[p + 2] = rgb[2];
    }
  }
  const idat = pngChunk("IDAT", zlib.deflateSync(raw));
  const iend = pngChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

// Known, distinct intrinsic dimensions for the aspect-ratio e2e test:
// landscape is 2:1 (width > height), portrait is 1:2 (height > width).
const LANDSCAPE_DIMENSIONS = { width: 400, height: 200 };
const PORTRAIT_DIMENSIONS = { width: 200, height: 400 };

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
  const res = await fetch("http://localhost:3000/api/dev/revalidate/gallery", {
    method: "POST",
  });
  if (!res.ok) {
    throw new Error(
      `Failed to revalidate gallery cache (status ${res.status}). Is E2E_TESTING set?`,
    );
  }
  await page.goto(path);
}

async function seedImage(opts: {
  id: string;
  imageUrl?: string;
  sortOrder: number;
  published: boolean;
  altText?: { nl: string; en?: string; fr?: string; de?: string };
}) {
  const sql = neon(process.env.DATABASE_URL!);
  const altTextJson = opts.altText ? JSON.stringify(opts.altText) : null;
  await sql`
    INSERT INTO gallery_image (id, image_url, sort_order, published, created_at, alt_text)
    VALUES (
      ${opts.id},
      ${opts.imageUrl ?? PLACEHOLDER_URL},
      ${opts.sortOrder},
      ${opts.published},
      now(),
      ${altTextJson}::jsonb
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

  test("published image alt text appears on the public page", async ({
    page,
  }) => {
    await seedImage({
      id: "gal-alt-nl",
      sortOrder: 1,
      published: true,
      altText: { nl: "Mooie zwembad" },
    });
    await gotoFresh(page, "/nl");
    const section = page.locator("[data-testid='gite-section']");
    await expect(section.locator("img[alt='Mooie zwembad']")).toBeVisible();
  });

  test("published image shows locale alt text when translation exists", async ({
    page,
  }) => {
    await seedImage({
      id: "gal-alt-en",
      sortOrder: 1,
      published: true,
      altText: { nl: "Mooie zwembad", en: "Beautiful pool" },
    });
    await gotoFresh(page, "/en");
    const section = page.locator("[data-testid='gite-section']");
    await expect(section.locator("img[alt='Beautiful pool']")).toBeVisible();
  });

  test("published image falls back to Dutch alt text when locale translation is missing", async ({
    page,
  }) => {
    await seedImage({
      id: "gal-alt-fallback",
      sortOrder: 1,
      published: true,
      altText: { nl: "Terras bij zonsondergang" },
    });
    await gotoFresh(page, "/fr");
    const section = page.locator("[data-testid='gite-section']");
    await expect(
      section.locator("img[alt='Terras bij zonsondergang']"),
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
    await expect(page.getByRole("link", { name: /galerij/i })).toBeVisible();
  });

  test("owner can upload an image and it appears in the gallery list", async ({
    page,
  }) => {
    await page.goto("/admin/gallery");
    const fileInput = page.locator("[data-testid='gallery-file-input']");
    // Wait for the dropzone to be visible so React has hydrated and attached onChange
    await expect(page.getByText(/sleep.*hierheen/i)).toBeVisible();
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
      { timeout: 15000 },
    );
  });

  test("owner can open the alt text dialog for an image", async ({ page }) => {
    await seedImage({ id: "gal-alt-dialog", sortOrder: 1, published: false });
    await page.goto("/admin/gallery");
    await page
      .locator("[data-testid='gallery-row-gal-alt-dialog']")
      .getByRole("button", { name: /alt.?tekst/i })
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(
      page.getByRole("dialog").getByLabel(/alt.?tekst/i),
    ).toBeVisible();
  });

  test("Opslaan saves and auto-translates alt text (single-save flow)", async ({
    page,
  }) => {
    await seedImage({
      id: "gal-alt-save",
      sortOrder: 1,
      published: true,
    });
    await page.goto("/admin/gallery");
    await page
      .locator("[data-testid='gallery-row-gal-alt-save']")
      .getByRole("button", { name: /alt.?tekst/i })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(/alt.?tekst/i).fill("Zonnebloemenveld");
    await dialog.getByRole("button", { name: /^opslaan$/i }).click();
    await expect(dialog).not.toBeVisible({ timeout: 15000 });

    // Assert the DB row has the expected machine translations (E2E stub appends " [locale]").
    const sql = neon(process.env.DATABASE_URL!);
    const rows =
      await sql`SELECT alt_text, alt_text_source FROM gallery_image WHERE id = 'gal-alt-save'`;
    const row = rows[0];
    expect(row.alt_text).toMatchObject({
      nl: "Zonnebloemenveld",
      en: "Zonnebloemenveld [en]",
      fr: "Zonnebloemenveld [fr]",
      de: "Zonnebloemenveld [de]",
    });
    expect(row.alt_text_source).toMatchObject({
      nl: "human",
      en: "machine",
      fr: "machine",
      de: "machine",
    });

    // Public page still shows Dutch alt text.
    await gotoFresh(page, "/nl");
    const section = page.locator("[data-testid='gite-section']");
    await expect(section.locator("img[alt='Zonnebloemenveld']")).toBeVisible();
  });

  test("owner can toggle published status", async ({ page }) => {
    await seedImage({ id: "gal-admin-toggle", sortOrder: 1, published: false });
    await page.goto("/admin/gallery");
    const row = page.locator("[data-testid='gallery-row-gal-admin-toggle']");
    await row.getByRole("checkbox", { name: /gepubliceerd/i }).check();
    await expect(
      row.getByRole("checkbox", { name: /gepubliceerd/i }),
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
      .getByRole("button", { name: /verwijderen/i })
      .click();
    await expect(
      page.locator("[data-testid='gallery-row-gal-admin-del']"),
    ).not.toBeVisible();
  });

  test("owner can reorder images by dragging", async ({ page }) => {
    await seedImage({ id: "gal-order-a", sortOrder: 10, published: false });
    await seedImage({ id: "gal-order-b", sortOrder: 20, published: false });
    await page.goto("/admin/gallery");

    const rowA = page.locator("[data-testid='gallery-row-gal-order-a']");
    const rowB = page.locator("[data-testid='gallery-row-gal-order-b']");
    await expect(rowA).toBeVisible();
    await expect(rowB).toBeVisible();

    // dnd-kit's PointerSensor needs gradual pointer movement to activate — dragTo()
    // fires a single synthetic event that doesn't cross the activation threshold.
    // Using mouse.move() with steps gives it enough events to register as a drag.
    const handleB = rowB.getByRole("button", {
      name: /slepen om te herordenen/i,
    });
    const boxB = await handleB.boundingBox();
    const boxA = await rowA.boundingBox();
    await page.mouse.move(
      boxB!.x + boxB!.width / 2,
      boxB!.y + boxB!.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      boxA!.x + boxA!.width / 2,
      boxA!.y + boxA!.height / 2,
      { steps: 20 },
    );
    await page.mouse.up();

    const rows = page.locator("[data-testid^='gallery-row-gal-order-']");
    await expect(rows.nth(0)).toHaveAttribute(
      "data-testid",
      "gallery-row-gal-order-b",
    );
    await expect(rows.nth(1)).toHaveAttribute(
      "data-testid",
      "gallery-row-gal-order-a",
    );
  });

  test("owner can upload multiple images at once", async ({ page }) => {
    await page.goto("/admin/gallery");
    const fileInput = page.locator("[data-testid='gallery-file-input']");
    await expect(page.getByText(/sleep.*hierheen/i)).toBeVisible();

    const minimalJpeg = Buffer.from(
      "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8U" +
        "HRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgN" +
        "DRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIy" +
        "MjL/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAA" +
        "AAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/" +
        "aAAwDAQACEQMRAD8AJQAB/9k=",
      "base64",
    );

    await fileInput.setInputFiles([
      { name: "photo-1.jpg", mimeType: "image/jpeg", buffer: minimalJpeg },
      { name: "photo-2.jpg", mimeType: "image/jpeg", buffer: minimalJpeg },
    ]);

    await expect(
      page.getByRole("button", { name: /2 afbeeldingen uploaden/i }),
    ).toBeVisible();

    await page
      .getByRole("button", { name: /2 afbeeldingen uploaden/i })
      .click();

    await expect(page.locator("[data-testid='gallery-list'] img")).toHaveCount(
      2,
      { timeout: 15000 },
    );
  });

  test("uploaded photos render at their own aspect ratio in the public gallery dialog", async ({
    page,
  }) => {
    // Real upload, through the actual admin form (same mechanism as "owner can
    // upload an image"): one landscape (2:1) and one portrait (1:2) PNG, built
    // with known, distinct intrinsic dimensions so the browser's
    // createImageBitmap() captures real, distinguishable width/height.
    await page.goto("/admin/gallery");
    const fileInput = page.locator("[data-testid='gallery-file-input']");
    await expect(page.getByText(/sleep.*hierheen/i)).toBeVisible();

    await fileInput.setInputFiles([
      {
        name: "landscape.png",
        mimeType: "image/png",
        buffer: makePng(
          LANDSCAPE_DIMENSIONS.width,
          LANDSCAPE_DIMENSIONS.height,
          [200, 100, 50],
        ),
      },
      {
        name: "portrait.png",
        mimeType: "image/png",
        buffer: makePng(
          PORTRAIT_DIMENSIONS.width,
          PORTRAIT_DIMENSIONS.height,
          [50, 100, 200],
        ),
      },
    ]);

    await page
      .getByRole("button", { name: /2 afbeeldingen uploaden/i })
      .click();
    await expect(page.locator("[data-testid='gallery-list'] img")).toHaveCount(
      2,
      { timeout: 15000 },
    );

    // Both uploads now persist their client-captured width/height. Publish
    // them so the public section shows them. We do this in SQL rather than
    // through the admin checkbox: togglePublishedAction is dispatched as a
    // fire-and-forget transition (`startTransition(() => void action())`), so
    // the checkbox re-enabling is optimistic and does NOT guarantee the write
    // has committed before we navigate away. Direct SQL is deterministic and
    // matches how the public-section tests above seed published rows.
    const sql = neon(process.env.DATABASE_URL!);
    await sql`UPDATE gallery_image SET published = true`;

    // The "Bekijk meer foto's" trigger is only visible on desktop when there
    // are MORE THAN 4 published images (with ≤4 the inline grid already shows
    // them all, so the trigger is `md:hidden` — see gite.tsx). Playwright's
    // viewport is desktop, so seed three more published rows (5 total). They
    // have no dimensions → they render in the fixed 3:2 fallback. Their
    // sort_orders come after both uploads (10, 20) so the public dialog renders
    // in a known order: landscape (img 0), portrait (img 1), then fillers.
    for (let i = 0; i < 3; i++) {
      await seedImage({
        id: `gal-e2e-aspect-filler-${i}`,
        sortOrder: 100 + i * 10,
        published: true,
      });
    }

    await gotoFresh(page, "/nl");
    await page.getByRole("button", { name: /bekijk meer foto/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("img")).toHaveCount(5);

    // GiteDialog renders images in sort_order (decorative alt=""), so identify
    // them by position rather than alt text: img 0 = landscape, img 1 =
    // portrait.
    const landscapeImg = dialog.locator("img").nth(0);
    const portraitImg = dialog.locator("img").nth(1);
    await expect(landscapeImg).toBeVisible();
    await expect(portraitImg).toBeVisible();

    const landscapeBox = await landscapeImg.boundingBox();
    const portraitBox = await portraitImg.boundingBox();
    expect(landscapeBox).not.toBeNull();
    expect(portraitBox).not.toBeNull();

    const landscapeRatio = landscapeBox!.width / landscapeBox!.height;
    const portraitRatio = portraitBox!.width / portraitBox!.height;

    // The regression this guards: if a shared `aspect-3/2` crop were
    // reintroduced, both images would render at ~1.5 regardless of their
    // real shape. Instead each must render at (roughly) its own intrinsic
    // ratio: 2:1 for the landscape photo, 1:2 for the portrait photo.
    // Loose bounds tolerate sub-pixel rounding from the browser's layout.
    expect(landscapeRatio).toBeGreaterThan(1.5);
    expect(landscapeRatio).toBeLessThan(2.5);
    expect(portraitRatio).toBeGreaterThan(0.4);
    expect(portraitRatio).toBeLessThan(0.667);
  });
});
