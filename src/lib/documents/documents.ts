import { getDb } from "@/db";
import { document } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { slugify } from "@/lib/content/slug";
import {
  deleteBlobAndRecord,
  deleteBlobBestEffort,
} from "@/lib/media/blob-delete";

/**
 * Finds a unique slug from `base`, appending `-2`, `-3`, … on collision
 * against `taken`. Falls back to `fallback` when `base` is empty (title had
 * no slug-worthy characters). Pure/sync so it's covered by unit tests
 * directly — mirrors `uniquePoiSlug` in the POI admin actions.
 */
export function uniqueSlugFrom(
  base: string,
  taken: Set<string>,
  fallback: string,
): string {
  const root = base || fallback;
  if (!taken.has(root)) return root;
  let n = 2;
  while (taken.has(`${root}-${n}`)) n++;
  return `${root}-${n}`;
}

/** All documents, ordered by creation time. */
export async function listDocuments() {
  const db = getDb();
  return db.select().from(document).orderBy(asc(document.createdAt));
}

/** The document with the given slug, or undefined if none exists. */
export async function getDocumentBySlug(slug: string) {
  const db = getDb();
  const [row] = await db.select().from(document).where(eq(document.slug, slug));
  return row;
}

/**
 * Creates a document. The slug is derived from `title` via `slugify`,
 * deduped against every existing slug (the table is small enough that
 * fetching all slugs once is cheaper than a LIKE query), and is stable
 * after create — renames never touch it.
 */
export async function createDocument({
  title,
  fileUrl,
}: {
  title: string;
  fileUrl: string;
}) {
  const db = getDb();
  const rows = await db.select({ slug: document.slug }).from(document);
  const taken = new Set(rows.map((r) => r.slug));
  const slug = uniqueSlugFrom(slugify(title), taken, "document");

  const [row] = await db
    .insert(document)
    .values({
      id: crypto.randomUUID(),
      title,
      slug,
      fileUrl,
    })
    .returning();
  return row;
}

/** Updates the title only; the slug is left untouched. */
export async function renameDocument(id: string, title: string) {
  const db = getDb();
  await db.update(document).set({ title }).where(eq(document.id, id));
}

/**
 * Replaces the file behind an existing slug: deletes the OLD blob
 * best-effort (a failed delete of the old file must never block saving the
 * new one), then points the row at `newFileUrl`.
 */
export async function replaceDocumentFile(id: string, newFileUrl: string) {
  const db = getDb();
  const [row] = await db.select().from(document).where(eq(document.id, id));
  if (!row) return;

  await deleteBlobBestEffort(row.fileUrl);

  await db
    .update(document)
    .set({ fileUrl: newFileUrl })
    .where(eq(document.id, id));
}

/** Deletes the blob and its DB row (strict delete-the-record contract). */
export async function deleteDocument(id: string) {
  const db = getDb();
  const [row] = await db
    .select({ fileUrl: document.fileUrl })
    .from(document)
    .where(eq(document.id, id));

  if (!row) return;

  await deleteBlobAndRecord(
    row.fileUrl,
    async () => {
      await db.delete(document).where(eq(document.id, id));
    },
    { entityLabel: "Document", id },
  );
}
