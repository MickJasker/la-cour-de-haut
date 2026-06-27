import { getDb } from "@/db";
import { galleryImage } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { del } from "@vercel/blob";

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
 * If step 3 fails after step 2 succeeded the original file content is no
 * longer available, so a binary restore is not feasible. The error is re-thrown
 * with a clear message so callers can surface it to the UI. The DB row still
 * exists at this point and can be cleaned up manually or retried.
 */
export async function deleteImage(id: string): Promise<void> {
  const db = getDb();

  const [row] = await db
    .select({ imageUrl: galleryImage.imageUrl })
    .from(galleryImage)
    .where(eq(galleryImage.id, id));

  if (!row) return;

  const { imageUrl } = row;

  let isVercelBlob = false;
  try {
    isVercelBlob = new URL(imageUrl).hostname.endsWith(
      "blob.vercel-storage.com",
    );
  } catch {
    // Malformed URL — treat as non-Blob and skip blob deletion.
  }
  if (isVercelBlob) {
    await del(imageUrl);
  }

  try {
    await db.delete(galleryImage).where(eq(galleryImage.id, id));
  } catch (dbError) {
    // The blob has already been deleted; binary content is no longer available
    // so a compensating restore is not feasible. Surface a clear error so the
    // UI can inform the user that manual cleanup of the DB row is required.
    throw new Error(
      `Gallery image blob was deleted from storage but the database record (id=${id}) could not be removed. ` +
        `Please delete the DB row manually.`,
      { cause: dbError },
    );
  }
}
