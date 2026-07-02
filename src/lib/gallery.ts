import { getDb } from "@/db";
import { galleryImage } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { deleteBlobAndRecord } from "@/lib/blob-delete";

/**
 * Returns the next sort-order value for a new gallery image.
 * Fetches the row with the highest sort_order using ORDER BY DESC LIMIT 1,
 * then returns that value + 10, defaulting to 10 when the table is empty.
 * Called by uploadGalleryImageAction to place new images at the end of the list.
 */
export async function nextSortOrder(): Promise<number> {
  const db = getDb();
  const [maxRow] = await db
    .select({ sortOrder: galleryImage.sortOrder })
    .from(galleryImage)
    .orderBy(desc(galleryImage.sortOrder))
    .limit(1);

  return maxRow != null ? (maxRow.sortOrder ?? 0) + 10 : 10;
}

/**
 * Deletes a gallery image from both Vercel Blob storage and the database.
 *
 * Order of operations:
 *   1. Fetch the image URL from the DB (no-op if the row is already gone).
 *   2. Delete the blob from Vercel Blob storage.
 *   3. Delete the DB row.
 *
 * Uses the shared strict delete-the-record contract (`deleteBlobAndRecord`)
 * — see that helper's doc comment for the full ordering/failure semantics,
 * including the descriptive re-throw when step 3 fails after step 2
 * succeeded.
 */
export async function deleteImage(id: string): Promise<void> {
  const db = getDb();

  const [row] = await db
    .select({ imageUrl: galleryImage.imageUrl })
    .from(galleryImage)
    .where(eq(galleryImage.id, id));

  if (!row) return;

  await deleteBlobAndRecord(
    row.imageUrl,
    async () => {
      await db.delete(galleryImage).where(eq(galleryImage.id, id));
    },
    { entityLabel: "Gallery image", id },
  );
}
