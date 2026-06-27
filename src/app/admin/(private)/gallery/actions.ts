"use server";

import { revalidatePath, updateTag } from "next/cache";
import { put } from "@vercel/blob";
import { getDb } from "@/db";
import { galleryImage } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifySession } from "@/lib/dal";
import { deleteImage, nextSortOrder } from "@/lib/gallery";

export async function uploadGalleryImageAction(formData: FormData) {
  await verifySession();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("No file provided");
  }

  const blob = await put(`gallery/${crypto.randomUUID()}-${file.name}`, file, {
    access: "public",
  });

  const db = getDb();
  const nextSort = await nextSortOrder();

  await db.insert(galleryImage).values({
    id: crypto.randomUUID(),
    imageUrl: blob.url,
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
