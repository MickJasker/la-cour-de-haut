import { test, expect, type Page } from "@playwright/test";
import { neon } from "@neondatabase/serverless";

async function clearContentBlocks() {
  const sql = neon(process.env.DATABASE_URL!);
  await sql`DELETE FROM content_block`;
}

// Minimal single-paragraph serialized Lexical EditorState — the "basic
// prose" shape hero_description/description are stored as (ADR-0017).
function paragraphState(text: string) {
  return {
    root: {
      type: "root",
      version: 1,
      direction: null,
      format: "",
      indent: 0,
      children: [
        {
          type: "paragraph",
          version: 1,
          direction: null,
          format: "",
          indent: 0,
          children: [
            {
              type: "text",
              version: 1,
              text,
              format: 0,
              style: "",
              mode: "normal",
              detail: 0,
            },
          ],
        },
      ],
    },
  };
}

async function seedRichText(opts: {
  key: string;
  value: { nl: string; en?: string; fr?: string; de?: string };
}) {
  const sql = neon(process.env.DATABASE_URL!);
  const localized: Record<string, unknown> = { type: "localizedEditorState" };
  for (const [locale, text] of Object.entries(opts.value)) {
    localized[locale] = paragraphState(text);
  }
  const value = JSON.stringify(localized);
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
    await seedRichText({
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
    await seedRichText({
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
    await seedRichText({
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

  test("description is pre-filled from DB", async ({ page }) => {
    await seedRichText({
      key: "description",
      value: { nl: "Vooraf ingevulde tekst." },
    });
    await page.goto("/admin/content");
    const giteSection = page.locator("[data-testid='admin-gite-section']");
    await expect(giteSection.getByLabel("Beschrijving (NL)")).toContainText(
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
    const nl = "Een mooie gîte in de Normandische heuvels.";
    await page.goto("/admin/content");
    const giteSection = page.locator("[data-testid='admin-gite-section']");
    await giteSection.getByLabel("Beschrijving (NL)").fill(nl);
    // Save triggers auto-translate server-side (no dialog needed).
    await giteSection.getByRole("button", { name: /opslaan/i }).click();
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    const sql = neon(process.env.DATABASE_URL!);
    const [row] = await sql`
      SELECT value, value_source FROM content_block WHERE key = 'description'
    `;

    // value_source: nl must be human, en/fr/de must be machine
    const src = row?.value_source as Record<string, string> | undefined;
    expect(src?.nl).toBe("human");
    expect(src?.en).toBe("machine");
    expect(src?.fr).toBe("machine");
    expect(src?.de).toBe("machine");

    // Every target locale got translated content (exact shape of the
    // HTML-bridge round-trip is covered at the unit level by bridge.test.ts).
    const val = row?.value as Record<string, unknown> | undefined;
    expect(val?.en).toBeTruthy();
    expect(val?.fr).toBeTruthy();
    expect(val?.de).toBeTruthy();
  });

  test("empty description shows a validation error", async ({ page }) => {
    await page.goto("/admin/content");
    const giteSection = page.locator("[data-testid='admin-gite-section']");
    await giteSection.getByRole("button", { name: /opslaan/i }).click();
    await expect(giteSection.getByText(/vereist/i)).toBeVisible();
  });

  // Exercises the client-side direct-to-Blob upload (#98): the file goes
  // straight from the browser to /api/admin/blob-upload (stubbed under
  // E2E_TESTING), and uploadHeroImageAction receives only the resulting URL.
  test("owner can upload a hero image and it appears on the public page", async ({
    page,
  }) => {
    await page.goto("/admin/content");
    const heroSection = page.locator("[data-testid='admin-hero-section']");
    // Wait for the dropzone to be visible so React has hydrated and attached
    // onChange (same pattern as gallery.spec.ts / pois.spec.ts) — otherwise
    // setInputFiles can land before the listener is attached and silently no-op.
    await expect(heroSection.getByText(/sleep.*hierheen/i)).toBeVisible();
    await heroSection.locator("[data-testid='hero-file-input']").setInputFiles({
      name: "hero-test.jpg",
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
    // Upload runs as soon as a file is picked (no separate "Opslaan" click).
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    const sql = neon(process.env.DATABASE_URL!);
    const [row] = await sql`
      SELECT value FROM content_block WHERE key = 'hero_image_url'
    `;
    const url = (row?.value as { url?: string } | undefined)?.url;
    expect(url).toContain("picsum.photos");

    const seed = url!.match(/seed\/([^/]+)/)?.[1];
    expect(seed).toBeTruthy();

    await gotoFresh(page, "/nl");
    const hero = page.locator("[data-testid='hero-section']");
    await expect(hero.locator(`img[src*='${seed}']`)).toBeVisible();
  });
});
