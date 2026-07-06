import { test, expect } from "@playwright/test";
import { neon } from "@neondatabase/serverless";

async function clearDocuments() {
  const sql = neon(process.env.DATABASE_URL!);
  await sql`TRUNCATE document`;
}

// Builds a minimal but structurally valid single-page PDF (%PDF-1.4 header,
// one Catalog/Pages/Page object, a sloppy-but-parseable xref, %%EOF trailer)
// with `marker` embedded verbatim in the bytes — the round-trip assertions
// below just grep the response body for the marker, so the PDF only needs to
// survive being stored/streamed unchanged, not actually render.
function makePdf(marker: string): Buffer {
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >>\nendobj\n",
    `4 0 obj\n<< /Length ${marker.length} >>\nstream\n${marker}\nendstream\nendobj\n`,
  ];

  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(body));
    body += obj;
  }
  const xrefOffset = Buffer.byteLength(body);

  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    xref += `${offset.toString().padStart(10, "0")} 00000 n \n`;
  }
  body += xref;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(body, "utf-8");
}

test.describe("documents: admin", () => {
  test.describe.configure({ mode: "serial" });
  test.use({ storageState: "e2e/.auth/owner.json" });

  test.beforeAll(clearDocuments);
  test.afterAll(clearDocuments);

  let publicLink: string;

  test("owner can upload a PDF and a row appears with a stable public link", async ({
    page,
  }) => {
    await page.goto("/admin/documents");
    await page.getByLabel("Titel").fill("Huisregels");
    await page.locator("[data-testid='document-file-input']").setInputFiles({
      name: "huisregels.pdf",
      mimeType: "application/pdf",
      buffer: makePdf("MARKER-A"),
    });
    await page.getByRole("button", { name: /^uploaden$/i }).click();

    const list = page.locator("[data-testid='document-list']");
    await expect(list.getByText("Huisregels", { exact: true })).toBeVisible({
      timeout: 15000,
    });

    const row = list.locator("li").filter({
      has: page.getByText("Huisregels", { exact: true }),
    });
    await expect(row.getByText(/\/documents\/huisregels\.pdf/)).toBeVisible();
    publicLink = (
      await row.getByText(/\/documents\/huisregels\.pdf/).innerText()
    ).trim();
    expect(publicLink).toContain("/documents/huisregels.pdf");
  });

  test("the public link streams the uploaded PDF bytes", async ({
    request,
  }) => {
    const res = await request.get(publicLink);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("application/pdf");
    expect(res.headers()["content-disposition"]).toContain("inline");
    const body = await res.text();
    expect(body).toContain("MARKER-A");
  });

  test("replacing the file keeps the same link but serves the new bytes", async ({
    page,
    request,
  }) => {
    // The replace pipeline (client upload → server action → DB commit) has
    // repeatedly needed more than the default budget on loaded CI runners.
    test.setTimeout(60_000);
    // A crashed client transition would otherwise surface only as a poll
    // timeout with no cause — collect page errors so the poll can report them.
    const pageErrors: Error[] = [];
    page.on("pageerror", (error) => pageErrors.push(error));

    await page.goto("/admin/documents");
    const list = page.locator("[data-testid='document-list']");
    const row = list.locator("li").filter({
      has: page.getByText("Huisregels", { exact: true }),
    });

    // The replace input fires on `change` with no separate submit button
    // (see documents-client.tsx), so setting files is the whole action —
    // no need to click "Vervangen" first. It's hidden (`className="hidden"`)
    // but setInputFiles works regardless of visibility.
    await row.locator("input[type='file']").setInputFiles({
      name: "huisregels-v2.pdf",
      mimeType: "application/pdf",
      buffer: makePdf("MARKER-B"),
    });

    // The replace input has no visible loading state to key off of; poll the
    // public link until it reflects the new bytes instead of asserting on a
    // fixed UI transition.
    await expect(async () => {
      expect(
        pageErrors,
        `client-side errors during replace: ${pageErrors.map(String).join("; ")}`,
      ).toHaveLength(0);
      const res = await request.get(publicLink);
      const body = await res.text();
      expect(body).toContain("MARKER-B");
    }).toPass({ timeout: 45_000 });

    const res = await request.get(publicLink);
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toContain("MARKER-B");
    expect(body).not.toContain("MARKER-A");

    await expect(row.getByText(/\/documents\/huisregels\.pdf/)).toBeVisible();
    const linkAfterReplace = (
      await row.getByText(/\/documents\/huisregels\.pdf/).innerText()
    ).trim();
    expect(linkAfterReplace).toBe(publicLink);
  });

  test("renaming the title keeps the slug (link) stable", async ({ page }) => {
    await page.goto("/admin/documents");
    const list = page.locator("[data-testid='document-list']");
    // Pin the row by its stable testid before entering edit mode: the
    // has-text filter stops matching the moment "Hernoemen" swaps the
    // title <p> for an input, so a live text-based locator would go stale.
    const rowTestId = await list
      .locator("li")
      .filter({ has: page.getByText("Huisregels", { exact: true }) })
      .getAttribute("data-testid");
    expect(rowTestId).not.toBeNull();
    const row = page.getByTestId(rowTestId!);

    await row.getByRole("button", { name: /^hernoemen$/i }).click();
    await row.getByLabel("Titel").fill("Huisregels (bijgewerkt)");
    await row.getByRole("button", { name: /^opslaan$/i }).click();

    await expect(
      list.getByText("Huisregels (bijgewerkt)", { exact: true }),
    ).toBeVisible({
      timeout: 15000,
    });
    const renamedRow = list.locator("li").filter({
      has: page.getByText("Huisregels (bijgewerkt)", { exact: true }),
    });
    const linkAfterRename = (
      await renamedRow.getByText(/\/documents\/huisregels\.pdf/).innerText()
    ).trim();
    expect(linkAfterRename).toBe(publicLink);
  });

  test("deleting the document removes the row and 404s the public link", async ({
    page,
    request,
  }) => {
    await page.goto("/admin/documents");
    const list = page.locator("[data-testid='document-list']");
    const row = list.locator("li").filter({
      has: page.getByText("Huisregels (bijgewerkt)", { exact: true }),
    });

    page.once("dialog", (dialog) => void dialog.accept());
    await row.getByRole("button", { name: /^verwijderen$/i }).click();

    await expect(
      list.getByText("Huisregels (bijgewerkt)", { exact: true }),
    ).not.toBeVisible();

    // The row disappears optimistically before deleteDocumentAction commits
    // (documents-client.tsx onDelete), so poll instead of asserting once.
    await expect(async () => {
      const res = await request.get(publicLink);
      expect(res.status()).toBe(404);
    }).toPass({ timeout: 15_000 });
  });

  test("an unknown slug 404s", async ({ request }) => {
    const res = await request.get("/documents/does-not-exist.pdf");
    expect(res.status()).toBe(404);
  });
});
