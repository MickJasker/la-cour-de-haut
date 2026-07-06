import { test, expect } from "@playwright/test";
import { neon } from "@neondatabase/serverless";

// Seeded system pages (privacy id="page_privacy", terms id="page_terms") are
// restored by global-setup's `pnpm db:migrate` (chained seed-pages script).
// Never TRUNCATE `page` — only ever delete owner-created rows.

const sql = neon(process.env.DATABASE_URL!);

async function clearOwnPages() {
  // Scoped to this spec's own rows (slug derives from the title "Huisregels"
  // via the translate stub; dedup can suffix it): spec files run in parallel
  // workers, so a blanket `system = false` delete would race pages.spec.ts's
  // seeded draft row.
  await sql`DELETE FROM page WHERE slug LIKE 'huisregels%'`;
}

async function getPageBySlug(slug: string) {
  const rows =
    await sql`SELECT id, slug, published, system FROM page WHERE slug = ${slug}`;
  return rows[0] as
    | { id: string; slug: string; published: boolean; system: boolean }
    | undefined;
}

test.describe("admin: pages", () => {
  test.describe.configure({ mode: "serial" });
  test.use({ storageState: "e2e/.auth/owner.json" });

  test.beforeAll(clearOwnPages);
  test.afterAll(clearOwnPages);

  // The E2E_TESTING translate stub returns "<text> [en]" instead of calling
  // Google Translate, so the Dutch title "Huisregels" produces the English
  // title "Huisregels [en]" and — via slugify — the derived slug
  // "huisregels-en". See src/lib/translation/stub-adapter.ts.
  const derivedSlug = "huisregels-en";

  test("owner can create a page; it derives a slug and starts as a draft", async ({
    page,
  }) => {
    await page.goto("/admin/pages");

    await page.getByLabel("Titel").fill("Huisregels");
    const editor = page.getByRole("textbox", { name: "Inhoud" });
    await editor.click();
    await editor.pressSequentially(
      "Dit zijn de huisregels van het huis. Graag rustig doen na 22:00 uur.",
      { delay: 10 },
    );

    await page.getByRole("button", { name: /^opslaan$/i }).click();

    const list = page.locator("[data-testid='page-list']");
    await expect(list.getByText("Huisregels", { exact: true })).toBeVisible({
      timeout: 15000,
    });
    await expect(list.getByText(`/nl/${derivedSlug}`)).toBeVisible();

    const row = list.locator("li").filter({
      has: page.getByText("Huisregels", { exact: true }),
    });
    await expect(
      row.getByRole("checkbox", { name: /gepubliceerd/i }),
    ).not.toBeChecked();

    // The row (and its "draft" state) is the source of truth here rather than
    // a public navigation, which would 404 for a draft anyway.
    await expect(async () => {
      const dbRow = await getPageBySlug(derivedSlug);
      expect(dbRow).toBeTruthy();
      expect(dbRow!.published).toBe(false);
      expect(dbRow!.system).toBe(false);
    }).toPass({ timeout: 15_000 });
  });

  test("the draft page 404s publicly until published", async ({ request }) => {
    await request.post("/api/dev/revalidate/pages");
    const res = await request.get(`/nl/${derivedSlug}`);
    expect(res.status()).toBe(404);
  });

  test("publishing the page makes it visible at its public URL", async ({
    page,
  }) => {
    await page.goto("/admin/pages");
    const list = page.locator("[data-testid='page-list']");
    const row = list.locator("li").filter({
      has: page.getByText("Huisregels", { exact: true }),
    });
    await row.getByRole("checkbox", { name: /gepubliceerd/i }).check();

    await expect(
      row.getByRole("checkbox", { name: /gepubliceerd/i }),
    ).toBeChecked();

    // togglePagePublishedAction calls updateTag itself, so the admin mutation
    // needs no explicit revalidate call — only the public navigation does,
    // since it hits a separately cached read.
    await expect(async () => {
      const dbRow = await getPageBySlug(derivedSlug);
      expect(dbRow?.published).toBe(true);
    }).toPass({ timeout: 15_000 });

    await page.request.post("/api/dev/revalidate/pages");
    await page.goto(`/nl/${derivedSlug}`);
    await expect(
      page.getByRole("heading", { name: "Huisregels" }),
    ).toBeVisible();
  });

  test("editing the title keeps the derived slug stable", async ({ page }) => {
    await page.goto("/admin/pages");
    const list = page.locator("[data-testid='page-list']");
    const row = list.locator("li").filter({
      has: page.getByText("Huisregels", { exact: true }),
    });
    await row.getByRole("button", { name: /^bewerken$/i }).click();

    await page.getByLabel("Titel").fill("Huisregels (bijgewerkt)");
    await page.getByRole("button", { name: /^opslaan$/i }).click();

    await expect(
      list.getByText("Huisregels (bijgewerkt)", { exact: true }),
    ).toBeVisible({ timeout: 15000 });
    await expect(list.getByText(`/nl/${derivedSlug}`)).toBeVisible();

    const dbRow = await getPageBySlug(derivedSlug);
    expect(dbRow).toBeTruthy();
  });

  test("deleting the page removes it and 404s the public URL", async ({
    page,
    request,
  }) => {
    await page.goto("/admin/pages");
    const list = page.locator("[data-testid='page-list']");
    const row = list.locator("li").filter({
      has: page.getByText("Huisregels (bijgewerkt)", { exact: true }),
    });

    page.once("dialog", (dialog) => void dialog.accept());
    await row.getByRole("button", { name: /^verwijderen$/i }).click();

    await expect(
      list.getByText("Huisregels (bijgewerkt)", { exact: true }),
    ).not.toBeVisible();

    // The row disappears optimistically before deletePageAction commits, so
    // poll the DB instead of asserting once (same pattern as documents.spec.ts).
    await expect(async () => {
      const dbRow = await getPageBySlug(derivedSlug);
      expect(dbRow).toBeUndefined();
    }).toPass({ timeout: 15_000 });

    await request.post("/api/dev/revalidate/pages");
    const res = await request.get(`/nl/${derivedSlug}`);
    expect(res.status()).toBe(404);
  });

  test("a system page shows no delete control and no publish toggle", async ({
    page,
  }) => {
    await page.goto("/admin/pages");
    const row = page.locator("[data-testid='page-row-page_privacy']");

    await expect(row.getByText("Privacybeleid", { exact: true })).toBeVisible();
    await expect(row.getByText("Systeempagina")).toBeVisible();
    await expect(
      row.getByRole("checkbox", { name: /gepubliceerd/i }),
    ).toHaveCount(0);
    await expect(
      row.getByRole("button", { name: /^verwijderen$/i }),
    ).toHaveCount(0);
    // Editing remains available — system page content is still owner-editable.
    await expect(
      row.getByRole("button", { name: /^bewerken$/i }),
    ).toBeVisible();
  });
});
