"use server";

import {
  createServerValidate,
  ServerValidateError,
  initialFormState,
} from "@tanstack/react-form-nextjs";
import { revalidatePath, updateTag } from "next/cache";
import { del } from "@vercel/blob";
import { getDb } from "@/db";
import { contentBlock } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifySession } from "@/lib/dal";
import { contentFormOpts, contentFormServerSchema } from "./shared";
import { resolveLocalizedText } from "@/lib/localized-field";

export type ContentActionState = {
  success: boolean;
  errorMap: { onServer?: unknown };
  values: unknown;
  errors: unknown[];
  failures?: string[];
};

const serverValidate = createServerValidate({
  ...contentFormOpts,
  onServerValidate: ({ value }) => {
    const result = contentFormServerSchema.safeParse(value);
    if (!result.success) {
      return result.error.issues[0]?.message ?? "Validatie mislukt";
    }
  },
});

function invalidate() {
  revalidatePath("/admin/content");
  updateTag("content");
}

async function upsertLocalizedText(
  key: string,
  nl: string,
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
    existing?.value?.type === "localizedText"
      ? {
          nl: existing.value.nl,
          en: existing.value.en,
          fr: existing.value.fr,
          de: existing.value.de,
        }
      : undefined;

  const result = await resolveLocalizedText(nl, stored);

  const value = {
    type: "localizedText" as const,
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
  try {
    const data = await serverValidate(formData);
    const { failures } = await upsertLocalizedText("description", data.nl);
    invalidate();
    return {
      ...initialFormState,
      success: true,
      failures: failures.length ? failures : undefined,
    };
  } catch (e) {
    if (e instanceof ServerValidateError) {
      return { ...e.formState, success: false };
    }
    throw e;
  }
}

export async function updateHeroDescriptionAction(
  _prev: unknown,
  formData: FormData,
): Promise<ContentActionState> {
  await verifySession();
  try {
    const data = await serverValidate(formData);
    const { failures } = await upsertLocalizedText("hero_description", data.nl);
    invalidate();
    return {
      ...initialFormState,
      success: true,
      failures: failures.length ? failures : undefined,
    };
  } catch (e) {
    if (e instanceof ServerValidateError) {
      return { ...e.formState, success: false };
    }
    throw e;
  }
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

  const existingUrl =
    existing?.value?.type === "imageUrl" ? existing.value.url : null;
  if (existingUrl?.includes("blob.vercel-storage.com")) {
    await del(existingUrl);
  }

  invalidate();
  return { error: null, success: true };
}
