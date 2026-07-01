/**
 * One-time, safe-to-re-run script to backfill width/height for existing
 * gallery photos (see #103/#104/#105).
 *
 * Finds every `gallery_image` row still missing `width` or `height`,
 * measures its real pixel dimensions from the stored Blob URL (reading only
 * the image header via `probe-image-size` — no full download/decode), and
 * updates the row. Only rows still missing dimensions are ever targeted, so
 * re-running after a partial run (or after fixing a broken URL) picks up
 * exactly where it left off. A row that can't be measured is skipped and
 * logged; it never aborts the rest of the run.
 *
 * NB: probe-image-size reads *pre*-orientation (EXIF) dimensions, whereas fresh
 * uploads capture *post*-orientation dimensions via createImageBitmap (see
 * gallery-client.tsx). For a rotated photo the two ingest paths can therefore
 * disagree. EXIF correction is out of scope for #103; a future EXIF issue
 * should reconcile them.
 *
 * Run with: pnpm backfill-gallery-dimensions
 */
try {
  process.loadEnvFile(".env.local");
} catch {}

const { getDb } = await import("@/db/index.js");
const { galleryImage } = await import("@/db/schema.js");
const { isNull, or, eq } = await import("drizzle-orm");
const { default: probe } = await import("probe-image-size");

const db = getDb();

const candidates = await db
  .select({
    id: galleryImage.id,
    imageUrl: galleryImage.imageUrl,
  })
  .from(galleryImage)
  .where(or(isNull(galleryImage.width), isNull(galleryImage.height)));

console.log(`Found ${candidates.length} gallery image(s) missing dimensions.`);

let updated = 0;
let skipped = 0;

for (const row of candidates) {
  try {
    const { width, height } = await probe(row.imageUrl);

    if (!width || !height) {
      console.warn(
        `Skipping gallery image ${row.id} (${row.imageUrl}): probe returned no usable dimensions`,
      );
      skipped++;
      continue;
    }

    await db
      .update(galleryImage)
      .set({ width, height })
      .where(eq(galleryImage.id, row.id));

    updated++;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(
      `Skipping gallery image ${row.id} (${row.imageUrl}): ${message}`,
    );
    skipped++;
  }
}

console.log(
  `Backfill complete: ${candidates.length} candidate(s), ${updated} updated, ${skipped} skipped.`,
);
