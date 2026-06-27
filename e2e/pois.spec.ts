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
  title?: string;
  body?: string;
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
  await sql`
    INSERT INTO poi (id, title, body, title_source, body_source, image_url, distance_km, sort_order, published, created_at)
    VALUES (
      ${opts.id},
      ${title}::jsonb,
      ${body}::jsonb,
      ${titleSource}::jsonb,
      ${bodySource}::jsonb,
      ${opts.imageUrl ?? PLACEHOLDER_URL},
      ${opts.distanceKm ?? null},
      ${opts.sortOrder ?? 0},
      ${opts.published},
      now()
    )
  `;
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
});
