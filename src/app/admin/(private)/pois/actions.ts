"use server";

import { revalidatePath, updateTag } from "next/cache";
import { put, del } from "@vercel/blob";
import { getDb } from "@/db";
import { poi } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifySession } from "@/lib/dal";

export async function createPoiAction(formData: FormData) {
  await verifySession();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("No image provided");
  }

  const blob = await put(`pois/${crypto.randomUUID()}-${file.name}`, file, {
    access: "public",
  });

  const title = formData.get("title");
  const body = formData.get("body");
  const distanceKmRaw = formData.get("distanceKm");
  const sortOrderRaw = formData.get("sortOrder");

  if (typeof title !== "string" || !title.trim())
    throw new Error("Title required");
  if (typeof body !== "string" || !body.trim())
    throw new Error("Body required");

  const distanceKm = distanceKmRaw ? Number(distanceKmRaw) : null;
  const sortOrder = sortOrderRaw ? Number(sortOrderRaw) : 0;

  const db = getDb();
  await db.insert(poi).values({
    id: crypto.randomUUID(),
    title: title.trim(),
    body: body.trim(),
    imageUrl: blob.url,
    distanceKm: distanceKm && !isNaN(distanceKm) ? distanceKm : null,
    sortOrder: isNaN(sortOrder) ? 0 : sortOrder,
    published: false,
  });

  revalidatePath("/admin/pois");
  updateTag("poi");
}

export async function togglePoiPublishedAction(id: string, published: boolean) {
  await verifySession();
  const db = getDb();
  await db.update(poi).set({ published }).where(eq(poi.id, id));
  revalidatePath("/admin/pois");
  updateTag("poi");
}

export async function deletePoiAction(id: string) {
  await verifySession();
  const db = getDb();
  const [row] = await db
    .select({ imageUrl: poi.imageUrl })
    .from(poi)
    .where(eq(poi.id, id));

  if (!row) return;

  if (row.imageUrl.includes("blob.vercel-storage.com")) {
    await del(row.imageUrl);
  }
  await db.delete(poi).where(eq(poi.id, id));

  revalidatePath("/admin/pois");
  updateTag("poi");
}

export async function reorderPoisAction(ids: string[]) {
  await verifySession();
  const db = getDb();
  await Promise.all(
    ids.map((id, index) =>
      db
        .update(poi)
        .set({ sortOrder: index * 10 })
        .where(eq(poi.id, id)),
    ),
  );
  revalidatePath("/admin/pois");
  updateTag("poi");
}
