"use server";

import { revalidatePath, updateTag } from "next/cache";
import { getDb } from "@/db";
import { galleryImage } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifySession } from "@/lib/auth/session";
import { deleteImage, nextSortOrder } from "@/lib/media/gallery";
import { saveAuthoredContent } from "@/lib/content/authored-save";
import { CACHE_TAGS } from "@/lib/cache-tags";

function invalidate() {
  revalidatePath("/admin/gallery");
  updateTag(CACHE_TAGS.gallery);
}

// Receives only the resulting Blob URL — the file itself was already
// streamed from the browser straight to Vercel Blob (see #98, upload-image.ts).
// `dimensions` are the file's real pixel width/height, read client-side
// before upload (see gallery-client.tsx's readImageDimensions) — a failed or
// zero-dimension capture is passed as null/undefined and never blocks the
// upload; the row is simply stored without dimensions, identical to a legacy
// row (see #103/#104).
export async function uploadGalleryImageAction(
  imageUrl: string,
  dimensions?: { width: number; height: number } | null,
) {
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
    width: dimensions?.width ?? null,
    height: dimensions?.height ?? null,
  });

  invalidate();
}

export async function togglePublishedAction(id: string, published: boolean) {
  await verifySession();
  const db = getDb();
  await db
    .update(galleryImage)
    .set({ published })
    .where(eq(galleryImage.id, id));
  invalidate();
}

export async function deleteGalleryImageAction(id: string) {
  await verifySession();
  await deleteImage(id);
  invalidate();
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

  const { failures } = await saveAuthoredContent({
    tag: CACHE_TAGS.gallery,
    revalidatePaths: ["/admin/gallery"],
    load: async () => {
      const existing = await db
        .select({ altText: galleryImage.altText })
        .from(galleryImage)
        .where(eq(galleryImage.id, id))
        .limit(1)
        .then((r) => r[0] ?? null);
      return existing?.altText ?? undefined;
    },
    fields: (stored) => ({
      altText: { kind: "text", source: nl, stored },
    }),
    persist: async (resolved) => {
      await db
        .update(galleryImage)
        .set({
          altText: resolved.altText.value,
          altTextSource: resolved.altText.source,
        })
        .where(eq(galleryImage.id, id));
    },
  });

  return { failures: failures.length ? failures : undefined };
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
  invalidate();
}
