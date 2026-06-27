import { test, expect, type Page } from "@playwright/test";
import { neon } from "@neondatabase/serverless";

async function clearContentBlocks() {
  const sql = neon(process.env.DATABASE_URL!);
  await sql`DELETE FROM content_block`;
}

async function seedLocalizedText(opts: {
  key: string;
  value: { nl: string; en?: string; fr?: string; de?: string };
}) {
  const sql = neon(process.env.DATABASE_URL!);
  const value = JSON.stringify({ type: "localizedText", ...opts.value });
  const valueSource = JSON.stringify({ nl: "human" });
  await sql`
    INSERT INTO content_block (key, value, value_source, updated_at)
    VALUES (${opts.key}, ${value}::jsonb, ${valueSource}::jsonb, now())
    ON CONFLICT (key) DO UPDATE
      SET value = EXCLUDED.value,
          value_source = EXCLUDED.value_source,
          updated_at = now()
  `;
}

async function seedImageUrl(opts: { key: string; url: string }) {
  const sql = neon(process.env.DATABASE_URL!);
  const value = JSON.stringify({ type: "imageUrl", url: opts.url });
  await sql`
    INSERT INTO content_block (key, value, updated_at)
    VALUES (${opts.key}, ${value}::jsonb, now())
    ON CONFLICT (key) DO UPDATE
      SET value = EXCLUDED.value,
          updated_at = now()
  `;
}

async function gotoFresh(page: Page, path: string) {
  const res = await fetch("http://localhost:3000/api/dev/revalidate/content", {
    method: "POST",
  });
  if (!res.ok) {
    throw new Error(
      `Failed to revalidate content cache (status ${res.status}). Is E2E_TESTING set?`,
    );
  }
  await page.goto(path);
}

// ---------------------------------------------------------------------------
// Public: Gîte section description
// ---------------------------------------------------------------------------

test.describe("content: gîte description — public", () => {
  test.beforeEach(clearContentBlocks);
  test.afterEach(clearContentBlocks);

  test("description from content_block appears in the Gîte section", async ({
    page,
  }) => {
    await seedLocalizedText({
      key: "description",
      value: { nl: "Een prachtige gîte in Normandië." },
    });
    await gotoFresh(page, "/nl");
    const section = page.locator("[data-testid='gite-section']");
    await expect(section).toBeVisible();
    await expect(
      section.getByText("Een prachtige gîte in Normandië."),
    ).toBeVisible();
  });

  test("gîte section renders without crashing when no description row exists", async ({
    page,
  }) => {
    // Seed a gallery image so the section renders (it currently returns null without images)
    const sql = neon(process.env.DATABASE_URL!);
    await sql`
      INSERT INTO gallery_image (id, image_url, sort_order, published, created_at)
      VALUES ('gite-content-img', 'https://picsum.photos/seed/ct/800/600', 0, true, now())
      ON CONFLICT (id) DO UPDATE SET image_url = EXCLUDED.image_url
    `;
    try {
      const res = await fetch(
        "http://localhost:3000/api/dev/revalidate/gallery",
        { method: "POST" },
      );
      if (!res.ok) throw new Error("Failed to revalidate gallery cache");
      await gotoFresh(page, "/nl");
      await expect(page.locator("[data-testid='gite-section']")).toBeVisible();
      // No crash — page loaded
    } finally {
      await sql`DELETE FROM gallery_image WHERE id = 'gite-content-img'`;
    }
  });

  test("description falls back to Dutch when requested locale key is absent", async ({
    page,
  }) => {
    await seedLocalizedText({
      key: "description",
      value: { nl: "Nederlandse tekst." },
      // no 'fr' key
    });
    await gotoFresh(page, "/fr");
    const section = page.locator("[data-testid='gite-section']");
    await expect(section.getByText("Nederlandse tekst.")).toBeVisible();
  });

  test("locale-specific description renders when locale key is present", async ({
    page,
  }) => {
    await seedLocalizedText({
      key: "description",
      value: { nl: "Nederlands", en: "English description here." },
    });
    await gotoFresh(page, "/en");
    const section = page.locator("[data-testid='gite-section']");
    await expect(section.getByText("English description here.")).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Public: Hero image
// ---------------------------------------------------------------------------

test.describe("content: hero image — public", () => {
  test.beforeEach(clearContentBlocks);
  test.afterEach(clearContentBlocks);

  test("hero section falls back to static image when no hero_image_url row exists", async ({
    page,
  }) => {
    await gotoFresh(page, "/nl");
    // Static fallback: the hero section renders without crash
    const hero = page.locator("[data-testid='hero-section']");
    await expect(hero).toBeVisible();
  });

  test("hero section shows Blob image when hero_image_url row exists", async ({
    page,
  }) => {
    await seedImageUrl({
      key: "hero_image_url",
      url: "https://picsum.photos/seed/hero-test/1200/800",
    });
    await gotoFresh(page, "/nl");
    const hero = page.locator("[data-testid='hero-section']");
    await expect(hero).toBeVisible();
    // Next.js Image rewrites src to /_next/image?url=...; match on encoded fragment
    await expect(hero.locator("img[src*='hero-test']")).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

test.describe("content: admin", () => {
  test.use({ storageState: "e2e/.auth/owner.json" });

  test.beforeEach(clearContentBlocks);
  test.afterEach(clearContentBlocks);

  test("Inhoud link is visible in the admin sidebar", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByRole("link", { name: /inhoud/i })).toBeVisible();
  });

  test("description textarea is pre-filled from DB", async ({ page }) => {
    await seedLocalizedText({
      key: "description",
      value: { nl: "Vooraf ingevulde tekst." },
    });
    await page.goto("/admin/content");
    const giteSection = page.locator("[data-testid='admin-gite-section']");
    await expect(giteSection.getByLabel("Beschrijving (NL)")).toHaveValue(
      "Vooraf ingevulde tekst.",
    );
  });

  test("saving description updates the public Gîte section", async ({
    page,
  }) => {
    await page.goto("/admin/content");
    const giteSection = page.locator("[data-testid='admin-gite-section']");
    await giteSection
      .getByLabel("Beschrijving (NL)")
      .fill("Opgeslagen beschrijving.");
    await giteSection.getByRole("button", { name: /opslaan/i }).click();
    // Wait for the server action network round-trip to complete
    await page.waitForLoadState("networkidle", { timeout: 10000 });
    await gotoFresh(page, "/nl");
    const section = page.locator("[data-testid='gite-section']");
    await expect(section.getByText("Opgeslagen beschrijving.")).toBeVisible();
  });

  test("auto-translated description locales are saved with machine source", async ({
    page,
  }) => {
    await page.goto("/admin/content");
    const giteSection = page.locator("[data-testid='admin-gite-section']");
    await giteSection
      .getByLabel("Beschrijving (NL)")
      .fill("Een mooie gîte in de Normandische heuvels.");
    // Step 1: open translate dialog
    await giteSection
      .getByRole("button", { name: /automatisch vertalen/i })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    // Step 2: fetch translations
    await dialog.getByRole("button", { name: /^vertalen$/i }).click();
    // Step 3: confirm and close
    await dialog.getByRole("button", { name: /opslaan/i }).click();
    await expect(dialog).not.toBeVisible({ timeout: 15000 });
    // Step 4: save the form
    await giteSection.getByRole("button", { name: /^opslaan$/i }).click();
    await page.waitForLoadState("networkidle", { timeout: 10000 });
    // Verify DB: EN/FR/DE source must be "machine", not "human"
    const sql = neon(process.env.DATABASE_URL!);
    const [row] = await sql`
      SELECT value_source FROM content_block WHERE key = 'description'
    `;
    const src = row?.value_source as Record<string, string> | undefined;
    expect(src?.nl).toBe("human");
    expect(src?.en).toBe("machine");
    expect(src?.fr).toBe("machine");
    expect(src?.de).toBe("machine");
  });

  test("manually entered EN description is not overwritten by auto-translate", async ({
    page,
  }) => {
    await seedLocalizedText({
      key: "description",
      value: {
        nl: "Oorspronkelijke tekst.",
        en: "Hand-written English.",
      },
    });
    // Mark EN as human in the DB
    const sql = neon(process.env.DATABASE_URL!);
    await sql`
      UPDATE content_block
      SET value_source = '{"nl":"human","en":"human"}'::jsonb
      WHERE key = 'description'
    `;
    await page.goto("/admin/content");
    const giteSection = page.locator("[data-testid='admin-gite-section']");
    // Open translate dialog, fetch, confirm
    await giteSection
      .getByRole("button", { name: /automatisch vertalen/i })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: /^vertalen$/i }).click();
    await dialog.getByRole("button", { name: /opslaan/i }).click();
    await expect(dialog).not.toBeVisible({ timeout: 15000 });
    await giteSection.getByRole("button", { name: /^opslaan$/i }).click();
    await page.waitForLoadState("networkidle", { timeout: 10000 });
    // EN must still be the hand-written value
    const [row] = await sql`
      SELECT value FROM content_block WHERE key = 'description'
    `;
    const val = row?.value as Record<string, string> | undefined;
    expect(val?.en).toBe("Hand-written English.");
  });

  test("empty Dutch description shows a validation error", async ({ page }) => {
    await page.goto("/admin/content");
    const giteSection = page.locator("[data-testid='admin-gite-section']");
    await giteSection.getByLabel("Beschrijving (NL)").fill("");
    await giteSection.getByRole("button", { name: /opslaan/i }).click();
    await expect(giteSection.getByText(/vereist/i)).toBeVisible();
  });
});
