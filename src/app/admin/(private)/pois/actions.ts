"use server";

import { revalidatePath, updateTag } from "next/cache";
import { put, del } from "@vercel/blob";
import { getDb } from "@/db";
import { poi } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifySession } from "@/lib/dal";

function parseDistanceKm(raw: FormDataEntryValue | null): number | null {
  if (raw === null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function parseSortOrder(raw: FormDataEntryValue | null): number {
  if (raw === null || raw === "") return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export async function createPoiAction(formData: FormData) {
  await verifySession();

  const title = formData.get("title");
  const body = formData.get("body");
  if (typeof title !== "string" || !title.trim())
    throw new Error("Title required");
  if (typeof body !== "string" || !body.trim())
    throw new Error("Body required");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0)
    throw new Error("No image provided");

  const blob = await put(`pois/${crypto.randomUUID()}-${file.name}`, file, {
    access: "public",
  });

  const db = getDb();
  await db.insert(poi).values({
    id: crypto.randomUUID(),
    title: title.trim(),
    body: body.trim(),
    imageUrl: blob.url,
    distanceKm: parseDistanceKm(formData.get("distanceKm")),
    sortOrder: parseSortOrder(formData.get("sortOrder")),
    published: formData.get("published") === "true",
  });

  revalidatePath("/admin/pois");
  updateTag("poi");
}

export async function updatePoiAction(id: string, formData: FormData) {
  await verifySession();

  const title = formData.get("title");
  const body = formData.get("body");
  if (typeof title !== "string" || !title.trim())
    throw new Error("Title required");
  if (typeof body !== "string" || !body.trim())
    throw new Error("Body required");

  const db = getDb();

  let imageUrl: string | undefined;
  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    const [existing] = await db
      .select({ imageUrl: poi.imageUrl })
      .from(poi)
      .where(eq(poi.id, id));
    if (existing?.imageUrl.includes("blob.vercel-storage.com")) {
      await del(existing.imageUrl);
    }
    const blob = await put(`pois/${crypto.randomUUID()}-${file.name}`, file, {
      access: "public",
    });
    imageUrl = blob.url;
  }

  await db
    .update(poi)
    .set({
      title: title.trim(),
      body: body.trim(),
      distanceKm: parseDistanceKm(formData.get("distanceKm")),
      sortOrder: parseSortOrder(formData.get("sortOrder")),
      published: formData.get("published") === "true",
      ...(imageUrl ? { imageUrl } : {}),
    })
    .where(eq(poi.id, id));

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
