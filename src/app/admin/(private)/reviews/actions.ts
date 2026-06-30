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
import { translateReviewBody } from "@/lib/translate";
import {
  buildReviewBody,
  type ReviewBody,
  type ReviewBodySource,
} from "@/lib/review-i18n";
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

const DISPLAY_LOCALES = ["nl", "en", "fr", "de"] as const;

/**
 * Auto-detects the review's source language and translates outward to the other
 * display locales. Includes a dirty-check + gap-fill so unchanged reviews skip
 * the Google call entirely, and degrades gracefully on translation failures so
 * the save never blocks. See ADR-0016.
 */
async function translateReviewOnSave(
  originalBody: string,
  stored?: {
    originalBody: string;
    originalLocale: string;
    body: ReviewBody;
    bodySource: ReviewBodySource;
  },
): Promise<{
  originalLocale: string;
  body: ReviewBody;
  bodySource: ReviewBodySource;
}> {
  // Dirty-check + gap-fill: skip translation when body is unchanged and every
  // target display locale (i.e. every locale that is not the stored source) is
  // already present in the stored body.
  if (stored) {
    const targetLocales = DISPLAY_LOCALES.filter(
      (l) => l !== stored.originalLocale,
    );
    const hasAllTargets = targetLocales.every((l) => !!stored.body[l]);
    if (stored.originalBody === originalBody && hasAllTargets) {
      return {
        originalLocale: stored.originalLocale,
        body: stored.body,
        bodySource: stored.bodySource,
      };
    }
  }

  // Translate: always auto-detect source language via the "und" sentinel.
  try {
    const { detectedSource, translations } = await translateReviewBody(
      originalBody,
      "und",
    );
    const { body, bodySource } = buildReviewBody({
      originalLocale: detectedSource,
      originalBody,
      translations,
    });
    return { originalLocale: detectedSource, body, bodySource };
  } catch {
    // Degrade gracefully: persist the original text; missing locales heal on
    // the next save (gap-fill will re-translate them). The owner never loses
    // work and is never blocked by a Google outage.
    const fallbackLocale = stored?.originalLocale ?? "und";
    const { body, bodySource } = buildReviewBody({
      originalLocale: fallbackLocale,
      originalBody,
      translations: {},
    });
    return { originalLocale: fallbackLocale, body, bodySource };
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
    const { originalLocale, body, bodySource } =
      await translateReviewOnSave(originalBody);
    const db = getDb();
    await db.insert(review).values({
      id: crypto.randomUUID(),
      authorName: data.authorName,
      rating: data.rating,
      reviewDate: data.reviewDate,
      source: data.source,
      originalLocale,
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
    const db = getDb();
    const [existing] = await db
      .select({
        originalBody: review.originalBody,
        originalLocale: review.originalLocale,
        body: review.body,
        bodySource: review.bodySource,
      })
      .from(review)
      .where(eq(review.id, id));
    const { originalLocale, body, bodySource } = await translateReviewOnSave(
      originalBody,
      existing
        ? {
            originalBody: existing.originalBody,
            originalLocale: existing.originalLocale,
            body: existing.body,
            bodySource: existing.bodySource,
          }
        : undefined,
    );
    await db
      .update(review)
      .set({
        authorName: data.authorName,
        rating: data.rating,
        reviewDate: data.reviewDate,
        source: data.source,
        originalLocale,
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
