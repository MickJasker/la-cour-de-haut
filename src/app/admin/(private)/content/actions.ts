"use server";

import {
  createServerValidate,
  ServerValidateError,
  initialFormState,
} from "@tanstack/react-form-nextjs";
import { revalidatePath, updateTag } from "next/cache";
import { put, del } from "@vercel/blob";
import { getDb } from "@/db";
import { contentBlock } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifySession } from "@/lib/dal";
import { contentFormOpts, contentFormServerSchema } from "./shared";

export type ContentActionState = {
  success: boolean;
  errorMap: { onServer?: unknown };
  values: unknown;
  errors: unknown[];
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
  en: string,
  fr: string,
  de: string,
) {
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
    .values({ key, value, valueSource })
    .onConflictDoUpdate({
      target: contentBlock.key,
      set: { value, valueSource, updatedAt: new Date() },
    });
}

export async function updateDescriptionAction(
  _prev: unknown,
  formData: FormData,
): Promise<ContentActionState> {
  await verifySession();
  try {
    const data = await serverValidate(formData);
    await upsertLocalizedText(
      "description",
      data.nl,
      data.en ?? "",
      data.fr ?? "",
      data.de ?? "",
    );
    invalidate();
    return { ...initialFormState, success: true };
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
    await upsertLocalizedText(
      "hero_description",
      data.nl,
      data.en ?? "",
      data.fr ?? "",
      data.de ?? "",
    );
    invalidate();
    return { ...initialFormState, success: true };
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

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Geen geldig bestand opgegeven", success: false };
  }

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

  const heroValue = { type: "imageUrl" as const, url: blob.url };
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
