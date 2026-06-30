import { test, expect, type Page } from "@playwright/test";
import { neon } from "@neondatabase/serverless";

const PLACEHOLDER_URL = "https://picsum.photos/seed/poi-test/800/600";

async function clearPois() {
  const sql = neon(process.env.DATABASE_URL!);
  await sql`TRUNCATE poi`;
}

async function gotoFresh(page: Page, path: string) {
  const res = await fetch("http://localhost:3000/api/dev/revalidate/poi", {
    method: "POST",
  });
  if (!res.ok) {
    throw new Error(
      `Failed to revalidate poi cache (status ${res.status}). Is E2E_TESTING set?`,
    );
  }
  await page.goto(path);
}

async function seedPoi(opts: {
  id: string;
  slug?: string;
  title?: string;
  body?: string;
  detail?: unknown; // a SerializedEditorState; stored under { nl: ... }
  imageUrl?: string;
  distanceKm?: number | null;
  sortOrder?: number;
  published: boolean;
}) {
  const sql = neon(process.env.DATABASE_URL!);
  const title = JSON.stringify({ nl: opts.title ?? "Mont Saint Michel" });
  const body = JSON.stringify({
    nl: opts.body ?? "Bezoek het sprookjeseiland.",
  });
  const titleSource = JSON.stringify({ nl: "human" });
  const bodySource = JSON.stringify({ nl: "human" });
  const slug = opts.slug ?? opts.id;
  const detail = opts.detail ? JSON.stringify({ nl: opts.detail }) : null;
  const detailSource = opts.detail ? JSON.stringify({ nl: "human" }) : null;
  await sql`
    INSERT INTO poi (id, slug, title, body, title_source, body_source, detail, detail_source, image_url, distance_km, sort_order, published, created_at)
    VALUES (
      ${opts.id},
      ${slug},
      ${title}::jsonb,
      ${body}::jsonb,
      ${titleSource}::jsonb,
      ${bodySource}::jsonb,
      ${detail}::jsonb,
      ${detailSource}::jsonb,
      ${opts.imageUrl ?? PLACEHOLDER_URL},
      ${opts.distanceKm ?? null},
      ${opts.sortOrder ?? 0},
      ${opts.published},
      now()
    )
  `;
}

// Minimal serialized Lexical EditorState exercising the rendered node set:
// an h2, a paragraph with a bold run, and a bullet list item.
function detailFixture() {
  const text = (t: string, format = 0) => ({
    type: "text",
    version: 1,
    text: t,
    format,
    style: "",
    mode: "normal",
    detail: 0,
  });
  const block = (extra: Record<string, unknown>, children: unknown[]) => ({
    version: 1,
    direction: null,
    format: "",
    indent: 0,
    children,
    ...extra,
  });
  return {
    root: block({ type: "root" }, [
      block({ type: "heading", tag: "h2" }, [text("Geschiedenis")]),
      block({ type: "paragraph" }, [
        text("Een "),
        text("beroemde", 1),
        text(" plek."),
      ]),
      block({ type: "list", listType: "bullet", tag: "ul", start: 1 }, [
        block({ type: "listitem", value: 1 }, [text("Eerste punt")]),
      ]),
    ]),
  };
}

test.describe("pois: public section", () => {
  test.beforeEach(clearPois);
  test.afterEach(clearPois);

  test("published POI appears in the Ontdek section", async ({ page }) => {
    await seedPoi({
      id: "poi-pub-1",
      published: true,
      title: "Mont Saint Michel",
    });
    await gotoFresh(page, "/nl");
    const section = page.locator("[data-testid='poi-section']");
    await expect(section).toBeVisible();
    await expect(section.getByText("Mont Saint Michel")).toBeVisible();
  });

  test("unpublished POI does not appear on the public page", async ({
    page,
  }) => {
    await seedPoi({ id: "poi-pub-2", published: true, title: "Visible" });
    await seedPoi({ id: "poi-priv-1", published: false, title: "Hidden" });
    await gotoFresh(page, "/nl");
    const section = page.locator("[data-testid='poi-section']");
    await expect(section.getByText("Visible")).toBeVisible();
    await expect(section.getByText("Hidden")).not.toBeVisible();
  });

  test("POIs appear in sort_order", async ({ page }) => {
    await seedPoi({
      id: "poi-sort-2",
      published: true,
      title: "Second",
      sortOrder: 20,
    });
    await seedPoi({
      id: "poi-sort-1",
      published: true,
      title: "First",
      sortOrder: 10,
    });
    await gotoFresh(page, "/nl");
    const section = page.locator("[data-testid='poi-section']");
    const cards = section.locator("[data-testid='poi-card']");
    await expect(cards.nth(0)).toContainText("First");
    await expect(cards.nth(1)).toContainText("Second");
  });

  test("section is not rendered when no published POIs", async ({ page }) => {
    await seedPoi({ id: "poi-hidden", published: false });
    await gotoFresh(page, "/nl");
    await expect(
      page.locator("[data-testid='poi-section']"),
    ).not.toBeAttached();
  });

  test("section heading reads Ontdek Normandië in Dutch", async ({ page }) => {
    await seedPoi({ id: "poi-title-nl", published: true });
    await gotoFresh(page, "/nl");
    await expect(
      page.getByRole("heading", { name: /Ontdek Normandië/i }),
    ).toBeVisible();
  });

  test("distance badge shown when distanceKm is set", async ({ page }) => {
    await seedPoi({
      id: "poi-dist-1",
      published: true,
      title: "Abbey",
      distanceKm: 46,
    });
    await gotoFresh(page, "/nl");
    const section = page.locator("[data-testid='poi-section']");
    await expect(section.getByText("46 km")).toBeVisible();
  });

  test("distance badge omitted when distanceKm is null", async ({ page }) => {
    await seedPoi({
      id: "poi-nodist-1",
      published: true,
      title: "Nearby",
      distanceKm: null,
    });
    await gotoFresh(page, "/nl");
    const section = page.locator("[data-testid='poi-section']");
    const card = section.locator("[data-testid='poi-card']").first();
    await expect(
      card.locator("[data-testid='poi-distance']"),
    ).not.toBeAttached();
  });
});

test.describe("pois: detail view", () => {
  test.beforeEach(clearPois);
  test.afterEach(clearPois);

  test("card opens an intercepted detail dialog with rich content", async ({
    page,
  }) => {
    await seedPoi({
      id: "poi-detail-1",
      slug: "mont-saint-michel",
      title: "Mont Saint Michel",
      detail: detailFixture(),
      published: true,
    });
    await gotoFresh(page, "/nl");

    await page
      .locator("[data-testid='poi-section']")
      .getByRole("link", { name: "Mont Saint Michel" })
      .click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 60_000 });
    await expect(
      dialog.getByRole("heading", { name: "Geschiedenis" }),
    ).toBeVisible();
    await expect(dialog.getByText("beroemde")).toBeVisible();
    await expect(dialog.getByText("Eerste punt")).toBeVisible();
    await expect(page).toHaveURL(/\/nl\/poi\/mont-saint-michel$/);
  });

  test("standalone detail page renders on direct visit", async ({ page }) => {
    await seedPoi({
      id: "poi-detail-2",
      slug: "bayeux",
      title: "Bayeux",
      detail: detailFixture(),
      published: true,
    });
    await gotoFresh(page, "/nl/poi/bayeux");

    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Bayeux" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Geschiedenis" }),
    ).toBeVisible();
  });

  test("unknown slug is not found", async ({ page }) => {
    await gotoFresh(page, "/nl/poi/bestaat-niet");
    await expect(
      page.getByRole("heading", { name: "Geschiedenis" }),
    ).toHaveCount(0);
  });

  test("unpublished POI detail is not found", async ({ page }) => {
    await seedPoi({
      id: "poi-detail-3",
      slug: "verborgen",
      title: "Verborgen",
      detail: detailFixture(),
      published: false,
    });
    await gotoFresh(page, "/nl/poi/verborgen");
    await expect(
      page.getByRole("heading", { name: "Geschiedenis" }),
    ).toHaveCount(0);
  });
});

test.describe("pois: admin validation", () => {
  test.use({ storageState: "e2e/.auth/owner.json" });

  test("shows inline error when title is empty on submit", async ({ page }) => {
    await page.goto("/admin/pois");
    await page.getByRole("button", { name: /opslaan/i }).click();
    await expect(
      page.locator("[data-field='title']").getByText("Vereist"),
    ).toBeVisible();
  });

  test("shows inline error when description is empty on submit", async ({
    page,
  }) => {
    await page.goto("/admin/pois");
    await page.getByLabel(/titel/i).fill("Test POI");
    await page.getByRole("button", { name: /opslaan/i }).click();
    await expect(
      page.locator("[data-field='body']").getByText("Vereist"),
    ).toBeVisible();
  });
});

test.describe("pois: admin", () => {
  test.use({ storageState: "e2e/.auth/owner.json" });

  test.beforeEach(clearPois);
  test.afterEach(clearPois);

  test("POIs link is accessible in the admin sidebar", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByRole("link", { name: /poi/i })).toBeVisible();
  });

  test("owner can create a POI and it appears in the list", async ({
    page,
  }) => {
    await page.goto("/admin/pois");
    await page.getByLabel(/titel/i).fill("Château Gaillard");
    await page.getByLabel(/beschrijving/i).fill("Indrukwekkend kasteel.");
    await page.getByLabel(/afstand/i).fill("28");

    const fileInput = page.locator("[data-testid='poi-file-input']");
    await fileInput.setInputFiles({
      name: "poi-test.jpg",
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

    await page.getByRole("button", { name: /opslaan/i }).click();
    await expect(page.locator("[data-testid^='poi-row-']")).toHaveCount(1, {
      timeout: 15000,
    });
    await expect(page.locator("[data-testid^='poi-row-']")).toContainText(
      "Château Gaillard",
    );
  });

  test("owner can toggle published status", async ({ page }) => {
    await seedPoi({ id: "poi-toggle-1", published: false });
    await page.goto("/admin/pois");
    const row = page.locator("[data-testid='poi-row-poi-toggle-1']");
    await row.getByRole("checkbox", { name: /gepubliceerd/i }).check();
    await expect(
      row.getByRole("checkbox", { name: /gepubliceerd/i }),
    ).toBeChecked();
  });

  test("owner can edit a POI title", async ({ page }) => {
    await seedPoi({ id: "poi-edit-1", published: false, title: "Original" });
    await page.goto("/admin/pois");
    await page
      .locator("[data-testid='poi-row-poi-edit-1']")
      .getByRole("button", { name: /bewerken/i })
      .click();
    await page.getByLabel(/titel/i).fill("Updated");
    await page.getByRole("button", { name: /opslaan/i }).click();
    await expect(
      page.locator("[data-testid='poi-row-poi-edit-1']"),
    ).toContainText("Updated");
  });

  test("owner can delete a POI", async ({ page }) => {
    await seedPoi({ id: "poi-del-1", published: false });
    await page.goto("/admin/pois");
    await expect(
      page.locator("[data-testid='poi-row-poi-del-1']"),
    ).toBeVisible();
    await page
      .locator("[data-testid='poi-row-poi-del-1']")
      .getByRole("button", { name: /verwijderen/i })
      .click();
    await expect(
      page.locator("[data-testid='poi-row-poi-del-1']"),
    ).not.toBeVisible();
  });

  test("saving a POI auto-translates title and body into en/fr/de", async ({
    page,
  }) => {
    const nlTitle = "Vertaal E2E Test";
    const nlBody = "Een testbeschrijving voor vertaling.";

    await page.goto("/admin/pois");
    await page.getByLabel(/titel/i).fill(nlTitle);
    await page.getByLabel(/beschrijving/i).fill(nlBody);

    const fileInput = page.locator("[data-testid='poi-file-input']");
    await fileInput.setInputFiles({
      name: "poi-test.jpg",
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

    await page.getByRole("button", { name: /opslaan/i }).click();

    // Wait for the POI to appear in the admin list (save + translate completed).
    await expect(page.locator("[data-testid^='poi-row-']")).toHaveCount(1, {
      timeout: 15000,
    });

    // Query the DB directly to verify that the action wrote translated slots.
    // E2E_TESTING stub: translateText(text, locale) → `${text} [${locale}]`
    const sql = neon(process.env.DATABASE_URL!);
    const [row] = await sql`
      SELECT title, body, title_source, body_source
      FROM poi
      WHERE title->>'nl' = ${nlTitle}
    `;

    expect(row).toBeDefined();
    expect(row.title.en).toBe(`${nlTitle} [en]`);
    expect(row.title.fr).toBe(`${nlTitle} [fr]`);
    expect(row.title.de).toBe(`${nlTitle} [de]`);

    expect(row.body.en).toBe(`${nlBody} [en]`);
    expect(row.body.fr).toBe(`${nlBody} [fr]`);
    expect(row.body.de).toBe(`${nlBody} [de]`);

    expect(row.title_source).toEqual({
      nl: "human",
      en: "machine",
      fr: "machine",
      de: "machine",
    });
    expect(row.body_source).toEqual({
      nl: "human",
      en: "machine",
      fr: "machine",
      de: "machine",
    });
  });
});
