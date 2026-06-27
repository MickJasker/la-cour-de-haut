"use server";

import {
  createServerValidate,
  ServerValidateError,
  initialFormState,
} from "@tanstack/react-form-nextjs";
import { revalidatePath, updateTag } from "next/cache";
import { put, del } from "@vercel/blob";
import { getDb } from "@/db";
import { poi } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifySession } from "@/lib/dal";
import { poiFormOpts, poiFormServerSchema } from "./shared";

export type PoiActionState = {
  success: boolean;
  errorMap: { onServer?: unknown };
  values: unknown;
  errors: unknown[];
};

const serverValidate = createServerValidate({
  ...poiFormOpts,
  onServerValidate: ({ value }) => {
    const result = poiFormServerSchema.safeParse(value);
    if (!result.success) {
      return result.error.issues[0]?.message ?? "Validatie mislukt";
    }
  },
});

function parseDistanceKm(raw: string | undefined): number | null {
  if (!raw || raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function parseSortOrder(raw: FormDataEntryValue | null): number {
  if (raw === null || raw === "") return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function invalidate() {
  revalidatePath("/admin/pois");
  updateTag("poi");
}

export async function createPoiAction(
  _prev: unknown,
  formData: FormData,
): Promise<PoiActionState> {
  await verifySession();
  try {
    const data = await serverValidate(formData);

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return {
        ...initialFormState,
        success: false,
        errorMap: { onServer: "Afbeelding is vereist" },
      };
    }

    const blob = await put(`pois/${crypto.randomUUID()}-${file.name}`, file, {
      access: "public",
    });

    const db = getDb();
    await db.insert(poi).values({
      id: crypto.randomUUID(),
      title: data.title.trim(),
      body: data.body.trim(),
      imageUrl: blob.url,
      distanceKm: parseDistanceKm(data.distanceKm),
      sortOrder: parseSortOrder(formData.get("sortOrder")),
      published: data.published,
    });

    invalidate();
    return { ...initialFormState, success: true };
  } catch (e) {
    if (e instanceof ServerValidateError) {
      return { ...e.formState, success: false };
    }
    throw e;
  }
}

export async function updatePoiAction(
  id: string,
  _prev: unknown,
  formData: FormData,
): Promise<PoiActionState> {
  await verifySession();
  try {
    const data = await serverValidate(formData);
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
        title: data.title.trim(),
        body: data.body.trim(),
        distanceKm: parseDistanceKm(data.distanceKm),
        sortOrder: parseSortOrder(formData.get("sortOrder")),
        published: data.published,
        ...(imageUrl ? { imageUrl } : {}),
      })
      .where(eq(poi.id, id));

    invalidate();
    return { ...initialFormState, success: true };
  } catch (e) {
    if (e instanceof ServerValidateError) {
      return { ...e.formState, success: false };
    }
    throw e;
  }
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
