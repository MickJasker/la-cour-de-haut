"use server";

import type { SerializedEditorState } from "lexical";
import { revalidatePath, updateTag } from "next/cache";
import { deleteBlobBestEffort } from "@/lib/media/blob-delete";
import { getDb } from "@/db";
import { contentBlock } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifySession } from "@/lib/auth/session";
import { saveAuthoredContent } from "@/lib/content/authored-save";
import { parseDetailField } from "@/lib/content/lexical/parse-detail-field";
import { CACHE_TAGS } from "@/lib/cache-tags";

export type ContentActionState = {
  success: boolean;
  error: string | null;
  failures?: string[];
};

function invalidate() {
  revalidatePath("/admin/content");
  updateTag(CACHE_TAGS.content);
}

async function upsertRichText(
  key: string,
  nl: SerializedEditorState,
): Promise<{ failures: string[] }> {
  const db = getDb();

  return saveAuthoredContent({
    tag: CACHE_TAGS.content,
    revalidatePaths: ["/admin/content"],
    load: async () => {
      const existing = await db
        .select({ value: contentBlock.value })
        .from(contentBlock)
        .where(eq(contentBlock.key, key))
        .limit(1)
        .then((r) => r[0] ?? null);

      return existing?.value?.type === "localizedEditorState"
        ? {
            nl: existing.value.nl,
            en: existing.value.en,
            fr: existing.value.fr,
            de: existing.value.de,
          }
        : undefined;
    },
    fields: (stored) => ({
      detail: { kind: "detail", source: nl, stored },
    }),
    persist: async (resolved) => {
      // `nl` is always populated here (the caller only calls `upsertRichText`
      // once `parseDetailField` returned non-null), so the "detail" field
      // always resolves — it's only `null` when `source` itself is `null`.
      const detail = resolved.detail!;
      const value = {
        type: "localizedEditorState" as const,
        nl: detail.value.nl,
        ...(detail.value.en ? { en: detail.value.en } : {}),
        ...(detail.value.fr ? { fr: detail.value.fr } : {}),
        ...(detail.value.de ? { de: detail.value.de } : {}),
      };

      await db
        .insert(contentBlock)
        .values({ key, value, valueSource: detail.source })
        .onConflictDoUpdate({
          target: contentBlock.key,
          set: { value, valueSource: detail.source, updatedAt: new Date() },
        });
    },
  });
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

export async function updateAboutUsDescriptionAction(
  _prev: unknown,
  formData: FormData,
): Promise<ContentActionState> {
  await verifySession();
  const detail = parseDetailField(formData);
  if (!detail) {
    return { success: false, error: "Vereist" };
  }
  const { failures } = await upsertRichText("about_us_description", detail.nl);
  return {
    success: true,
    error: null,
    failures: failures.length ? failures : undefined,
  };
}
