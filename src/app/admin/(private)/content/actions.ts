"use server";

import { revalidatePath, updateTag } from "next/cache";
import { put, del } from "@vercel/blob";
import { getDb } from "@/db";
import { contentBlock } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifySession } from "@/lib/dal";

export type ContentActionState = {
  errors: { descriptionNl?: string } | null;
  success: boolean;
};

function invalidate() {
  revalidatePath("/admin/content");
  updateTag("content");
}

export async function updateDescriptionAction(
  _prev: ContentActionState | null,
  formData: FormData,
): Promise<ContentActionState> {
  await verifySession();

  const nl = (formData.get("descriptionNl") as string | null)?.trim() ?? "";
  const en = (formData.get("descriptionEn") as string | null)?.trim() ?? "";
  const fr = (formData.get("descriptionFr") as string | null)?.trim() ?? "";
  const de = (formData.get("descriptionDe") as string | null)?.trim() ?? "";

  if (!nl) {
    return { errors: { descriptionNl: "Vereist" }, success: false };
  }

  const value = {
    type: "localizedText" as const,
    nl,
    ...(en ? { en } : {}),
    ...(fr ? { fr } : {}),
    ...(de ? { de } : {}),
  };

  const valueSource = {
    nl: "human" as const,
    ...(en ? { en: "human" as const } : {}),
    ...(fr ? { fr: "human" as const } : {}),
    ...(de ? { de: "human" as const } : {}),
  };

  const db = getDb();
  await db
    .insert(contentBlock)
    .values({ key: "description", value, valueSource })
    .onConflictDoUpdate({
      target: contentBlock.key,
      set: { value, valueSource, updatedAt: new Date() },
    });

  invalidate();

  return { errors: null, success: true };
}

export async function uploadHeroImageAction(formData: FormData) {
  await verifySession();

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return;

  const db = getDb();
  const existing = await db
    .select({ value: contentBlock.value })
    .from(contentBlock)
    .where(eq(contentBlock.key, "hero_image_url"))
    .limit(1)
    .then((r) => r[0] ?? null);

  const blob = await put(`content/${crypto.randomUUID()}-${file.name}`, file, {
    access: "public",
  });

  const existingUrl =
    existing?.value?.type === "imageUrl" ? existing.value.url : null;
  if (existingUrl?.includes("blob.vercel-storage.com")) {
    await del(existingUrl);
  }

  const heroValue = { type: "imageUrl" as const, url: blob.url };
  await db
    .insert(contentBlock)
    .values({ key: "hero_image_url", value: heroValue })
    .onConflictDoUpdate({
      target: contentBlock.key,
      set: { value: heroValue, valueSource: null, updatedAt: new Date() },
    });

  invalidate();
}
