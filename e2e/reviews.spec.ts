import { test, expect, type Page } from "@playwright/test";
import { neon } from "@neondatabase/serverless";

async function clearReviews() {
  const sql = neon(process.env.DATABASE_URL!);
  await sql`TRUNCATE review`;
}

async function gotoFresh(page: Page, path: string) {
  const res = await fetch("http://localhost:3000/api/dev/revalidate-reviews", {
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
  sortOrder?: number;
  published: boolean;
}) {
  const sql = neon(process.env.DATABASE_URL!);
  await sql`
    INSERT INTO review (id, author_name, rating, review_date, source, body, body_source, published, sort_order, created_at)
    VALUES (
      ${opts.id},
      ${opts.authorName ?? "Test Guest"},
      ${opts.rating ?? 5},
      ${opts.reviewDate ?? "2024-06-01"},
      ${opts.source ?? "airbnb"},
      ${JSON.stringify({ nl: opts.body ?? "Geweldige plek!" })}::jsonb,
      ${JSON.stringify({ nl: "human" })}::jsonb,
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
});

test.describe("reviews: admin", () => {
  test.use({ storageState: "e2e/.auth/owner.json" });

  test.beforeEach(clearReviews);
  test.afterEach(clearReviews);

  test("reviews page is accessible in the admin sidebar", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByRole("link", { name: /reviews/i })).toBeVisible();
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
    await page.getByLabel(/author/i).fill("Johan");
    await page.getByLabel(/date/i).fill("2024-07-01");
    await page.getByLabel(/body/i).fill("Prachtig verblijf!");
    await page.getByLabel(/source/i).selectOption("natuurhuisje");
    // Star picker: click the 4th star
    await page.locator("[data-testid='star-4']").click();
    await page.getByRole("button", { name: /save/i }).click();
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
      .getByRole("button", { name: /delete/i })
      .click();
    await expect(
      page.locator("[data-testid='review-row-rev-del-1']"),
    ).not.toBeVisible();
  });

  test("owner can toggle published status", async ({ page }) => {
    await seedReview({ id: "rev-toggle-1", published: false });
    await page.goto("/admin/reviews");
    const row = page.locator("[data-testid='review-row-rev-toggle-1']");
    await row.getByRole("checkbox", { name: /published/i }).check();
    await expect(
      row.getByRole("checkbox", { name: /published/i }),
    ).toBeChecked();
  });
});
