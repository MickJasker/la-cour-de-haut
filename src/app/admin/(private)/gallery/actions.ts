"use server";

import { revalidatePath, updateTag } from "next/cache";
import { put, del } from "@vercel/blob";
import { getDb } from "@/db";
import { galleryImage } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { verifySession } from "@/lib/dal";

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
  const maxRow = await db
    .select({ sortOrder: galleryImage.sortOrder })
    .from(galleryImage)
    .orderBy(desc(galleryImage.sortOrder))
    .limit(1);

  const nextSort = maxRow.length > 0 ? (maxRow[0]?.sortOrder ?? 0) + 10 : 10;

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
  const db = getDb();
  const [row] = await db
    .select({ imageUrl: galleryImage.imageUrl })
    .from(galleryImage)
    .where(eq(galleryImage.id, id));

  if (!row) return;

  if (row.imageUrl.includes("blob.vercel-storage.com")) {
    await del(row.imageUrl);
  }
  await db.delete(galleryImage).where(eq(galleryImage.id, id));

  revalidatePath("/admin/gallery");
  updateTag("gallery");
}
