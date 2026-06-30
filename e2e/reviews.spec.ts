import { test, expect, type Page } from "@playwright/test";
import { neon } from "@neondatabase/serverless";

async function clearReviews() {
  const sql = neon(process.env.DATABASE_URL!);
  await sql`TRUNCATE review`;
}

async function gotoFresh(page: Page, path: string) {
  const res = await fetch("http://localhost:3000/api/dev/revalidate/reviews", {
    method: "POST",
  });
  if (!res.ok) {
    throw new Error(
      `Failed to revalidate reviews cache (status ${res.status}). Is E2E_TESTING set?`,
    );
  }
  await page.goto(path);
}

async function seedReview(opts: {
  id: string;
  authorName?: string;
  rating?: number;
  reviewDate?: string;
  source?: string;
  body?: string;
  bodyMap?: Record<string, string>;
  bodySource?: Record<string, string>;
  originalLocale?: string;
  originalBody?: string;
  sortOrder?: number;
  published: boolean;
}) {
  const sql = neon(process.env.DATABASE_URL!);
  const text = opts.body ?? "Geweldige plek!";
  const bodyMap = opts.bodyMap ?? { nl: text };
  const bodySource = opts.bodySource ?? { nl: "human" };
  const originalLocale = opts.originalLocale ?? "nl";
  const originalBody = opts.originalBody ?? text;
  await sql`
    INSERT INTO review (id, author_name, rating, review_date, source, original_locale, original_body, body, body_source, published, sort_order, created_at)
    VALUES (
      ${opts.id},
      ${opts.authorName ?? "Test Guest"},
      ${opts.rating ?? 5},
      ${opts.reviewDate ?? "2024-06-01"},
      ${opts.source ?? "airbnb"},
      ${originalLocale},
      ${originalBody},
      ${JSON.stringify(bodyMap)}::jsonb,
      ${JSON.stringify(bodySource)}::jsonb,
      ${opts.published},
      ${opts.sortOrder ?? 0},
      now()
    )
  `;
}

test.describe("reviews: public section", () => {
  test.beforeEach(clearReviews);
  test.afterEach(clearReviews);

  test("published review appears in the reviews section", async ({ page }) => {
    await seedReview({ id: "rev-pub-1", published: true, authorName: "Anna" });
    await gotoFresh(page, "/nl");
    const section = page.locator("[data-testid='reviews-section']");
    await expect(section).toBeVisible();
    await expect(section.getByText("Anna")).toBeVisible();
  });

  test("unpublished review does not appear on the public page", async ({
    page,
  }) => {
    await seedReview({
      id: "rev-pub-2",
      published: true,
      authorName: "Published",
    });
    await seedReview({
      id: "rev-priv-1",
      published: false,
      authorName: "Hidden",
    });
    await gotoFresh(page, "/nl");
    const section = page.locator("[data-testid='reviews-section']");
    await expect(section.getByText("Published")).toBeVisible();
    await expect(section.getByText("Hidden")).not.toBeVisible();
  });

  test("reviews appear in sort_order", async ({ page }) => {
    await seedReview({
      id: "rev-sort-2",
      published: true,
      authorName: "Second",
      sortOrder: 20,
    });
    await seedReview({
      id: "rev-sort-1",
      published: true,
      authorName: "First",
      sortOrder: 10,
    });
    await gotoFresh(page, "/nl");
    const section = page.locator("[data-testid='reviews-section']");
    const cards = section.locator("[data-testid='review-card']");
    await expect(cards.nth(0)).toContainText("First");
    await expect(cards.nth(1)).toContainText("Second");
  });

  test("no reviews section rendered when no published reviews", async ({
    page,
  }) => {
    await seedReview({ id: "rev-hidden", published: false });
    await gotoFresh(page, "/nl");
    await expect(
      page.locator("[data-testid='reviews-section']"),
    ).not.toBeAttached();
  });

  test("machine-translated slot shows a 'translated from' marker", async ({
    page,
  }) => {
    // English original, machine-translated into Dutch; a Dutch visitor sees the
    // marker naming the original language (ADR-0014).
    await seedReview({
      id: "rev-marker-1",
      published: true,
      authorName: "Giulia",
      originalLocale: "en",
      originalBody: "Lovely place",
      bodyMap: { en: "Lovely place", nl: "Mooie plek" },
      bodySource: { en: "human", nl: "machine" },
    });
    await gotoFresh(page, "/nl");
    const card = page.locator("[data-testid='review-card']");
    await expect(card.getByText("Mooie plek")).toBeVisible();
    await expect(
      card.locator("[data-testid='review-translated-marker']"),
    ).toContainText("Engels");
  });

  test("original-language slot shows no 'translated from' marker", async ({
    page,
  }) => {
    // Same review read in English (the human original slot) — no marker.
    await seedReview({
      id: "rev-marker-2",
      published: true,
      authorName: "Giulia",
      originalLocale: "en",
      originalBody: "Lovely place",
      bodyMap: { en: "Lovely place", nl: "Mooie plek" },
      bodySource: { en: "human", nl: "machine" },
    });
    await gotoFresh(page, "/en");
    const card = page.locator("[data-testid='review-card']");
    await expect(card.getByText("Lovely place")).toBeVisible();
    await expect(
      card.locator("[data-testid='review-translated-marker']"),
    ).toHaveCount(0);
  });
});

test.describe("reviews: admin validation", () => {
  test.use({ storageState: "e2e/.auth/owner.json" });

  test("shows inline error when author name is empty on submit", async ({
    page,
  }) => {
    await page.goto("/admin/reviews/new");
    await page.getByRole("button", { name: /opslaan/i }).click();
    await expect(
      page.locator("[data-field='authorName']").getByText("Vereist"),
    ).toBeVisible();
  });

  test("shows inline error when review body is empty on submit", async ({
    page,
  }) => {
    await page.goto("/admin/reviews/new");
    await page.getByLabel(/auteur/i).fill("Test");
    await page.getByRole("button", { name: /opslaan/i }).click();
    await expect(
      page.locator("[data-field='body']").getByText("Vereist"),
    ).toBeVisible();
  });

  test("shows inline error when date is not selected on submit", async ({
    page,
  }) => {
    await page.goto("/admin/reviews/new");
    await page.getByLabel(/auteur/i).fill("Test");
    await page.getByLabel(/recensie/i).fill("Mooie plek.");
    await page.getByRole("button", { name: /opslaan/i }).click();
    await expect(
      page.locator("[data-field='reviewDate']").getByText("Vereist"),
    ).toBeVisible();
  });
});

test.describe("reviews: admin", () => {
  test.use({ storageState: "e2e/.auth/owner.json" });

  test.beforeEach(clearReviews);
  test.afterEach(clearReviews);

  test("reviews page is accessible in the admin sidebar", async ({ page }) => {
    await page.goto("/admin");
    await expect(
      page.getByRole("link", { name: /beoordelingen/i }),
    ).toBeVisible();
  });

  test("admin list shows review with author, rating, date, source, published", async ({
    page,
  }) => {
    await seedReview({
      id: "rev-admin-1",
      published: true,
      authorName: "Marie",
      rating: 5,
      reviewDate: "2024-06-15",
      source: "airbnb",
    });
    await page.goto("/admin/reviews");
    const row = page.locator("[data-testid='review-row-rev-admin-1']");
    await expect(row).toBeVisible();
    await expect(row).toContainText("Marie");
    await expect(row).toContainText("5");
    await expect(row).toContainText("2024-06-15");
    await expect(row).toContainText("AirBnB");
  });

  test("owner can create a review", async ({ page }) => {
    await page.goto("/admin/reviews/new");
    await page.getByLabel(/auteur/i).fill("Johan");
    // Open the calendar popover and pick the 15th of whatever month is shown
    await page.getByRole("button", { name: /pick a date/i }).click();
    await page.getByRole("gridcell", { name: "15" }).first().click();
    await page.getByLabel(/recensie/i).fill("Prachtig verblijf!");
    await page.getByLabel(/bron/i).selectOption("natuurhuisje");
    // Star picker: click the 4th star
    await page.locator("[data-testid='star-4']").click();
    await page.getByRole("button", { name: /opslaan/i }).click();
    await expect(page.locator("[data-testid^='review-row-']")).toHaveCount(1);
    await expect(page.locator("[data-testid^='review-row-']")).toContainText(
      "Johan",
    );
  });

  test("owner can delete a review", async ({ page }) => {
    await seedReview({
      id: "rev-del-1",
      published: false,
      authorName: "To Delete",
    });
    await page.goto("/admin/reviews");
    await expect(
      page.locator("[data-testid='review-row-rev-del-1']"),
    ).toBeVisible();
    await page
      .locator("[data-testid='review-row-rev-del-1']")
      .getByRole("button", { name: /verwijderen/i })
      .click();
    await expect(
      page.locator("[data-testid='review-row-rev-del-1']"),
    ).not.toBeVisible();
  });

  test("owner can toggle published status", async ({ page }) => {
    await seedReview({ id: "rev-toggle-1", published: false });
    await page.goto("/admin/reviews");
    const row = page.locator("[data-testid='review-row-rev-toggle-1']");
    await row.getByRole("checkbox", { name: /gepubliceerd/i }).check();
    await expect(
      row.getByRole("checkbox", { name: /gepubliceerd/i }),
    ).toBeChecked();
  });

  test("translate-on-save: auto-detects language and fills all display locales", async ({
    page,
  }) => {
    const authorName = "E2ETranslateAuthor";
    const body = "Great place to stay";

    await page.goto("/admin/reviews/new");
    await page.getByLabel(/auteur/i).fill(authorName);
    // Open the calendar popover and pick the 15th of whatever month is shown
    await page.getByRole("button", { name: /pick a date/i }).click();
    await page.getByRole("gridcell", { name: "15" }).first().click();
    await page.getByLabel(/recensie/i).fill(body);
    await page.getByRole("button", { name: /opslaan/i }).click();

    // Wait for redirect and new row to appear
    await expect(page.locator("[data-testid^='review-row-']")).toHaveCount(1);

    // Assert via SQL: E2E stub detects "en" for "und" and stubs other locales
    // as "<text> [<locale>]"; the source slot (en) is seeded verbatim as human.
    const sql = neon(process.env.DATABASE_URL!);
    const rows = await sql`
      SELECT original_locale, body, body_source
      FROM review
      WHERE author_name = ${authorName}
    `;
    expect(rows).toHaveLength(1);
    const row = rows[0] as {
      original_locale: string;
      body: Record<string, string>;
      body_source: Record<string, string>;
    };

    expect(row.original_locale).toBe("en");
    expect(row.body.en).toBe(body);
    expect(row.body.nl).toBe(`${body} [nl]`);
    expect(row.body.fr).toBe(`${body} [fr]`);
    expect(row.body.de).toBe(`${body} [de]`);
    expect(row.body_source.en).toBe("human");
    expect(row.body_source.nl).toBe("machine");
    expect(row.body_source.fr).toBe("machine");
    expect(row.body_source.de).toBe("machine");
  });
});
