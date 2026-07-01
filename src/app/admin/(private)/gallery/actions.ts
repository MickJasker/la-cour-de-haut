"use server";

import { revalidatePath, updateTag } from "next/cache";
import { getDb } from "@/db";
import { galleryImage } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifySession } from "@/lib/dal";
import { deleteImage, nextSortOrder } from "@/lib/gallery";
import { resolveLocalizedText } from "@/lib/localized-field";

// Receives only the resulting Blob URL — the file itself was already
// streamed from the browser straight to Vercel Blob (see #98, upload-image.ts).
export async function uploadGalleryImageAction(imageUrl: string) {
  await verifySession();
  if (!imageUrl) {
    throw new Error("No image URL provided");
  }

  const db = getDb();
  const nextSort = await nextSortOrder();

  await db.insert(galleryImage).values({
    id: crypto.randomUUID(),
    imageUrl,
    sortOrder: nextSort,
    published: false,
  });

  revalidatePath("/admin/gallery");
  updateTag("gallery");
}

export async function togglePublishedAction(id: string, published: boolean) {
  await verifySession();
  const db = getDb();
  await db
    .update(galleryImage)
    .set({ published })
    .where(eq(galleryImage.id, id));
  revalidatePath("/admin/gallery");
  updateTag("gallery");
}

export async function deleteGalleryImageAction(id: string) {
  await verifySession();
  await deleteImage(id);
  revalidatePath("/admin/gallery");
  updateTag("gallery");
}

export type SaveAltTextActionState = {
  failures?: string[];
};

export async function saveAltTextAction(
  id: string,
  nl: string,
): Promise<SaveAltTextActionState> {
  await verifySession();
  const db = getDb();

  // Load existing alt-text to enable dirty-check and gap-fill (ADR-0016).
  const existing = await db
    .select({ altText: galleryImage.altText })
    .from(galleryImage)
    .where(eq(galleryImage.id, id))
    .limit(1)
    .then((r) => r[0] ?? null);

  const stored = existing?.altText ?? undefined;
  const result = await resolveLocalizedText(nl, stored);

  await db
    .update(galleryImage)
    .set({
      altText: result.value,
      altTextSource: result.source,
    })
    .where(eq(galleryImage.id, id));

  revalidatePath("/admin/gallery");
  updateTag("gallery");

  return { failures: result.failures.length ? result.failures : undefined };
}

export async function reorderGalleryImagesAction(ids: string[]) {
  await verifySession();
  const db = getDb();
  await Promise.all(
    ids.map((id, index) =>
      db
        .update(galleryImage)
        .set({ sortOrder: index * 10 })
        .where(eq(galleryImage.id, id)),
    ),
  );
  revalidatePath("/admin/gallery");
  updateTag("gallery");
}
