import { del } from "@vercel/blob";

/**
 * True only for URLs actually hosted on Vercel Blob (hostname parsed via
 * `URL()`, not a substring match — a substring check would also match a
 * non-Blob URL that merely contains the string elsewhere, e.g. in a query
 * param). Malformed URLs and other hosts (notably the E2E `picsum.photos`
 * stub used in `E2E_TESTING`, see CONTEXT.md's Media storage section) are
 * treated as "not ours to delete" and return false.
 */
export function isVercelBlobUrl(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith("blob.vercel-storage.com");
  } catch {
    return false;
  }
}

/**
 * Deletes `url` from Vercel Blob storage if (and only if) it's a Blob URL;
 * anything else is silently skipped. Errors from the underlying `del()` call
 * propagate to the caller.
 *
 * This is the strict primitive: use it directly when a failed blob delete
 * should abort the operation (see `deleteBlobAndRecord`). For replace flows
 * where a failed delete of the OLD image must never block saving the NEW
 * one, use `deleteBlobBestEffort` instead.
 */
export async function deleteBlob(url: string): Promise<void> {
  if (!isVercelBlobUrl(url)) return;
  await del(url);
}

/**
 * Best-effort variant of `deleteBlob` for replace flows: swallows (and
 * logs) any failure instead of throwing, so a Blob-storage hiccup while
 * cleaning up the OLD image never blocks persisting the NEW one. The stale
 * blob is simply leaked in that case rather than the whole save failing.
 */
export async function deleteBlobBestEffort(url: string): Promise<void> {
  try {
    await deleteBlob(url);
  } catch (error) {
    console.error(`Failed to delete replaced Blob image at ${url}`, error);
  }
}

/**
 * Strict delete-the-record contract, shared by flows that delete both the
 * blob and its owning DB row (e.g. gallery images, POIs).
 *
 * Order of operations:
 *   1. Delete the blob (if it's a Blob URL).
 *   2. Run `deleteRecord` to remove the DB row.
 *
 * If step 1 fails, nothing has been removed from the DB yet, so the whole
 * operation is safe to retry. If `deleteRecord` fails *after* the blob has
 * already been deleted, the binary content is gone and a compensating
 * restore isn't feasible — the error is wrapped with a descriptive message
 * (naming `entityLabel`/`id`) and re-thrown so the caller can surface it to
 * the UI; the DB row still exists at that point and can be cleaned up
 * manually or retried.
 */
export async function deleteBlobAndRecord(
  url: string,
  deleteRecord: () => Promise<void>,
  { entityLabel, id }: { entityLabel: string; id: string },
): Promise<void> {
  await deleteBlob(url);

  try {
    await deleteRecord();
  } catch (dbError) {
    throw new Error(
      `${entityLabel} blob was deleted from storage but the database record (id=${id}) could not be removed. ` +
        `Please delete the DB row manually.`,
      { cause: dbError },
    );
  }
}
