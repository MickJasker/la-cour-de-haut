"use server";

import type { SerializedEditorState } from "lexical";
import { revalidatePath, updateTag } from "next/cache";
import { deleteBlobBestEffort } from "@/lib/blob-delete";
import { getDb } from "@/db";
import { contentBlock } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifySession } from "@/lib/dal";
import { resolveLocalizedDetail } from "@/lib/localized-detail";
import { parseDetailField } from "@/lib/lexical/parse-detail-field";

export type ContentActionState = {
  success: boolean;
  error: string | null;
  failures?: string[];
};

function invalidate() {
  revalidatePath("/admin/content");
  updateTag("content");
}

async function upsertRichText(
  key: string,
  nl: SerializedEditorState,
): Promise<{ failures: string[] }> {
  const db = getDb();

  // Load existing row to enable dirty-check and gap-fill (ADR-0016).
  const existing = await db
    .select({ value: contentBlock.value })
    .from(contentBlock)
    .where(eq(contentBlock.key, key))
    .limit(1)
    .then((r) => r[0] ?? null);

  const stored =
    existing?.value?.type === "localizedEditorState"
      ? {
          nl: existing.value.nl,
          en: existing.value.en,
          fr: existing.value.fr,
          de: existing.value.de,
        }
      : undefined;

  const result = await resolveLocalizedDetail(nl, stored);

  const value = {
    type: "localizedEditorState" as const,
    nl: result.value.nl,
    ...(result.value.en ? { en: result.value.en } : {}),
    ...(result.value.fr ? { fr: result.value.fr } : {}),
    ...(result.value.de ? { de: result.value.de } : {}),
  };

  await db
    .insert(contentBlock)
    .values({ key, value, valueSource: result.source })
    .onConflictDoUpdate({
      target: contentBlock.key,
      set: { value, valueSource: result.source, updatedAt: new Date() },
    });

  return { failures: result.failures };
}

export async function updateDescriptionAction(
  _prev: unknown,
  formData: FormData,
): Promise<ContentActionState> {
  await verifySession();
  const detail = parseDetailField(formData);
  if (!detail) {
    return { success: false, error: "Vereist" };
  }
  const { failures } = await upsertRichText("description", detail.nl);
  invalidate();
  return {
    success: true,
    error: null,
    failures: failures.length ? failures : undefined,
  };
}

export async function updateHeroDescriptionAction(
  _prev: unknown,
  formData: FormData,
): Promise<ContentActionState> {
  await verifySession();
  const detail = parseDetailField(formData);
  if (!detail) {
    return { success: false, error: "Vereist" };
  }
  const { failures } = await upsertRichText("hero_description", detail.nl);
  invalidate();
  return {
    success: true,
    error: null,
    failures: failures.length ? failures : undefined,
  };
}

export type UploadHeroActionState = {
  error: string | null;
  success: boolean;
};

export async function uploadHeroImageAction(
  _prev: UploadHeroActionState | null,
  formData: FormData,
): Promise<UploadHeroActionState> {
  await verifySession();

  const imageUrl = formData.get("imageUrl");
  if (typeof imageUrl !== "string" || imageUrl.trim() === "") {
    return { error: "Geen geldige afbeelding opgegeven", success: false };
  }

  const db = getDb();
  const existing = await db
    .select({ value: contentBlock.value })
    .from(contentBlock)
    .where(eq(contentBlock.key, "hero_image_url"))
    .limit(1)
    .then((r) => r[0] ?? null);

  const heroValue = { type: "imageUrl" as const, url: imageUrl };
  await db
    .insert(contentBlock)
    .values({ key: "hero_image_url", value: heroValue })
    .onConflictDoUpdate({
      target: contentBlock.key,
      set: { value: heroValue, valueSource: null, updatedAt: new Date() },
    });

  // Best-effort: a failed delete of the OLD image must not block saving
  // the new one (see deleteBlobBestEffort's doc comment). The new value is
  // already committed above.
  const existingUrl =
    existing?.value?.type === "imageUrl" ? existing.value.url : null;
  if (existingUrl) {
    await deleteBlobBestEffort(existingUrl);
  }

  invalidate();
  return { error: null, success: true };
}
