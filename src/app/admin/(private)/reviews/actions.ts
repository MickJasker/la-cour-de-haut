"use server";

import {
  createServerValidate,
  ServerValidateError,
  initialFormState,
} from "@tanstack/react-form-nextjs";
import { revalidatePath, updateTag } from "next/cache";
import { getDb } from "@/db";
import { review } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifySession } from "@/lib/dal";
import { translateToAllLocales, translateReviewBody } from "@/lib/translate";
import { buildReviewBody, type ReviewBody } from "@/lib/review-i18n";
import { reviewFormOpts, reviewFormServerSchema } from "./shared";

export type ReviewActionState = {
  success: boolean;
  errorMap: { onServer?: unknown };
  values: unknown;
  errors: unknown[];
};

const serverValidate = createServerValidate({
  ...reviewFormOpts,
  onServerValidate: ({ value }) => {
    const result = reviewFormServerSchema.safeParse(value);
    if (!result.success) {
      return result.error.issues[0]?.message ?? "Validatie mislukt";
    }
  },
});

function invalidate() {
  revalidatePath("/admin/reviews");
  updateTag("reviews");
}

// The display-locale translations the owner may have fetched before saving.
// buildReviewBody is the single authority on body/bodySource, so this only
// needs to surface whatever machine translations exist.
function parseTranslations(formData: FormData): ReviewBody {
  const raw = formData.get("translations");
  if (typeof raw !== "string" || !raw) return {};
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    const out: ReviewBody = {};
    for (const locale of ["nl", "en", "fr", "de"] as const) {
      const value = obj[locale];
      if (typeof value === "string" && value.trim()) out[locale] = value.trim();
    }
    return out;
  } catch {
    return {};
  }
}

export async function createReviewAction(
  _prev: unknown,
  formData: FormData,
): Promise<ReviewActionState> {
  await verifySession();
  try {
    const data = await serverValidate(formData);
    const originalBody = data.originalBody.trim();
    const { body, bodySource } = buildReviewBody({
      originalLocale: data.originalLocale,
      originalBody,
      translations: parseTranslations(formData),
    });
    const db = getDb();
    await db.insert(review).values({
      id: crypto.randomUUID(),
      authorName: data.authorName,
      rating: data.rating,
      reviewDate: data.reviewDate,
      source: data.source,
      originalLocale: data.originalLocale,
      originalBody,
      body,
      bodySource,
      published: data.published,
      sortOrder: 0,
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

export async function updateReviewAction(
  id: string,
  _prev: unknown,
  formData: FormData,
): Promise<ReviewActionState> {
  await verifySession();
  try {
    const data = await serverValidate(formData);
    const originalBody = data.originalBody.trim();
    const { body, bodySource } = buildReviewBody({
      originalLocale: data.originalLocale,
      originalBody,
      translations: parseTranslations(formData),
    });
    const db = getDb();
    await db
      .update(review)
      .set({
        authorName: data.authorName,
        rating: data.rating,
        reviewDate: data.reviewDate,
        source: data.source,
        originalLocale: data.originalLocale,
        originalBody,
        body,
        bodySource,
        published: data.published,
      })
      .where(eq(review.id, id));
    invalidate();
    return { ...initialFormState, success: true };
  } catch (e) {
    if (e instanceof ServerValidateError) {
      return { ...e.formState, success: false };
    }
    throw e;
  }
}

export async function deleteReviewAction(id: string) {
  await verifySession();
  const db = getDb();
  await db.delete(review).where(eq(review.id, id));
  invalidate();
}

export async function toggleReviewPublishedAction(
  id: string,
  published: boolean,
) {
  await verifySession();
  const db = getDb();
  await db.update(review).set({ published }).where(eq(review.id, id));
  invalidate();
}

export async function reorderReviewsAction(ids: string[]) {
  await verifySession();
  const db = getDb();
  await Promise.all(
    ids.map((id, index) =>
      db
        .update(review)
        .set({ sortOrder: index * 10 })
        .where(eq(review.id, id)),
    ),
  );
  invalidate();
}

// Authored content (POIs, content blocks): always Dutch → EN/FR/DE.
export async function translateTextAction(
  text: string,
): Promise<{ en: string; fr: string; de: string }> {
  await verifySession();
  return translateToAllLocales(text);
}

// Quoted content (reviews): translate outward from the review's original
// locale, auto-detecting when it is "und". Returns the detected source plus
// the machine translations for the non-source display locales. See ADR-0014.
export async function translateReviewTextAction(
  text: string,
  sourceLocale: string,
): Promise<{ detectedSource: string; translations: ReviewBody }> {
  await verifySession();
  return translateReviewBody(text, sourceLocale);
}

// Persists machine translations onto an existing review. buildReviewBody
// recomputes both body and bodySource from the review's verbatim original,
// and original_locale is overwritten with the (possibly detected) source.
export async function translateReviewAction(
  id: string,
  input: { sourceLocale: string; translations: ReviewBody },
): Promise<void> {
  await verifySession();
  const db = getDb();
  const [row] = await db
    .select({ originalBody: review.originalBody })
    .from(review)
    .where(eq(review.id, id));
  if (!row) return;
  const { body, bodySource } = buildReviewBody({
    originalLocale: input.sourceLocale,
    originalBody: row.originalBody,
    translations: input.translations,
  });
  await db
    .update(review)
    .set({ originalLocale: input.sourceLocale, body, bodySource })
    .where(eq(review.id, id));
  invalidate();
}
