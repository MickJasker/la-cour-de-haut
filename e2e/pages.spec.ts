import { test, expect, type Page } from "@playwright/test";
import { neon } from "@neondatabase/serverless";

// Seeded system pages (privacy, terms) are restored by global-setup's
// `pnpm db:migrate` (chained seed-pages script), so specs may rely on them
// existing. Never TRUNCATE `page` — delete owner-created rows only.

const sql = neon(process.env.DATABASE_URL!);

const MINIMAL_BODY = {
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
        textFormat: 0,
        textStyle: "",
        children: [
          {
            type: "text",
            version: 1,
            text: "Testtekst voor een pagina.",
            detail: 0,
            format: 0,
            mode: "normal",
            style: "",
          },
        ],
      },
    ],
  },
};

async function seedPage(opts: {
  id: string;
  slug?: string;
  title?: string;
  published: boolean;
}) {
  const title = JSON.stringify({ nl: opts.title ?? "Testpagina" });
  const source = JSON.stringify({ nl: "human" });
  const body = JSON.stringify({ nl: MINIMAL_BODY });
  await sql`
    INSERT INTO page (id, slug, title, title_source, body, body_source, published, system)
    VALUES (
      ${opts.id},
      ${opts.slug ?? opts.id},
      ${title}::jsonb,
      ${source}::jsonb,
      ${body}::jsonb,
      ${source}::jsonb,
      ${opts.published},
      false
    )
    ON CONFLICT (id) DO NOTHING
  `;
}

async function deleteSeededPage(id: string) {
  // Scoped to this spec's own rows: spec files run in parallel workers, so a
  // blanket `system = false` delete would race admin-pages.spec.ts's live
  // rows. (System pages must survive regardless: global-setup only reseeds
  // them once per run.)
  await sql`DELETE FROM page WHERE id = ${id}`;
}

async function gotoFresh(page: Page, path: string) {
  // Direct-SQL seeds bypass updateTag; force the cached page queries stale.
  await page.request.post("/api/dev/revalidate/pages");
  await page.goto(path);
}

test.describe("pages: public", () => {
  // System pages (terms, privacy) are owner-editable content: CI's throwaway
  // DB branches off real data, so their body/title/excerpt can be anything.
  // Assert only structure on them; content-coupled assertions (body render,
  // excerpt description, hreflang) run against a spec-owned seeded page.

  test("seeded terms system page renders at /nl/terms", async ({ page }) => {
    await gotoFresh(page, "/nl/terms");

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      /\S/,
    );
    await expect(
      page.locator('link[rel="alternate"][hreflang="en"]'),
    ).toHaveAttribute("href", /\/en\/terms$/);
    await expect(
      page.locator('link[rel="alternate"][hreflang="x-default"]'),
    ).toHaveAttribute("href", /\/nl\/terms$/);
  });

  test("page metadata and body come from the DB page", async ({ page }) => {
    await deleteSeededPage("e2e-pub");
    await seedPage({ id: "e2e-pub", title: "Testpagina", published: true });

    await gotoFresh(page, "/nl/e2e-pub");

    await expect(
      page.getByRole("heading", { name: "Testpagina", level: 1 }),
    ).toBeVisible();
    await expect(page.getByText("Testtekst voor een pagina.")).toBeVisible();
    await expect(page).toHaveTitle("Testpagina · La Cour de Haut");
    // No separate description field (ADR-0020): the excerpt of the body text.
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      /Testtekst voor een pagina/,
    );
    await expect(
      page.locator('link[rel="alternate"][hreflang="en"]'),
    ).toHaveAttribute("href", /\/en\/e2e-pub$/);
    await expect(
      page.locator('link[rel="alternate"][hreflang="x-default"]'),
    ).toHaveAttribute("href", /\/nl\/e2e-pub$/);

    await deleteSeededPage("e2e-pub");
  });

  test("privacy is served from the DB page (hardcoded route removed)", async ({
    page,
  }) => {
    await gotoFresh(page, "/nl/privacy");

    // A 200 with an h1 proves the [slug] DB route serves it — the hardcoded
    // route no longer exists in code. Content itself is owner-editable.
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      /\S/,
    );
  });

  test("sitemap lists both system pages", async ({ request }) => {
    await request.post("/api/dev/revalidate/pages");
    const res = await request.get("/sitemap.xml");
    expect(res.status()).toBe(200);
    const xml = await res.text();
    expect(xml).toContain("/nl/terms");
    expect(xml).toContain("/nl/privacy");
  });

  test("unknown slug returns 404", async ({ page }) => {
    await page.request.post("/api/dev/revalidate/pages");
    const response = await page.goto("/nl/no-such-page");
    expect(response?.status()).toBe(404);
  });

  test("unpublished draft page returns 404", async ({ page }) => {
    await deleteSeededPage("e2e-draft");
    await seedPage({ id: "e2e-draft", published: false });

    const response = await page.goto("/nl/e2e-draft");
    expect(response?.status()).toBe(404);

    await deleteSeededPage("e2e-draft");
  });
});
