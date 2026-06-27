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
import { translateToAllLocales } from "@/lib/translate";
import {
  reviewFormOpts,
  reviewFormServerSchema,
  localizedStringSchema,
} from "./shared";

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

function parseBody(formData: FormData) {
  const raw = formData.get("body");
  const parsed =
    typeof raw === "string"
      ? (() => {
          try {
            return JSON.parse(raw);
          } catch {
            return raw;
          }
        })()
      : raw;
  return localizedStringSchema.parse(parsed);
}

function inferBodySource(body: ReturnType<typeof localizedStringSchema.parse>) {
  return {
    nl: "human" as const,
    ...(body.en ? { en: "machine" as const } : {}),
    ...(body.fr ? { fr: "machine" as const } : {}),
    ...(body.de ? { de: "machine" as const } : {}),
  };
}

export async function createReviewAction(
  _prev: unknown,
  formData: FormData,
): Promise<ReviewActionState> {
  await verifySession();
  try {
    const data = await serverValidate(formData);
    const body = parseBody(formData);
    const bodyValue = {
      nl: body.nl.trim(),
      ...(body.en ? { en: body.en.trim() } : {}),
      ...(body.fr ? { fr: body.fr.trim() } : {}),
      ...(body.de ? { de: body.de.trim() } : {}),
    };
    const db = getDb();
    await db.insert(review).values({
      id: crypto.randomUUID(),
      authorName: data.authorName,
      rating: data.rating,
      reviewDate: data.reviewDate,
      source: data.source,
      body: bodyValue,
      bodySource: inferBodySource(body),
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
    const body = parseBody(formData);
    const bodyValue = {
      nl: body.nl.trim(),
      ...(body.en ? { en: body.en.trim() } : {}),
      ...(body.fr ? { fr: body.fr.trim() } : {}),
      ...(body.de ? { de: body.de.trim() } : {}),
    };
    const db = getDb();
    await db
      .update(review)
      .set({
        authorName: data.authorName,
        rating: data.rating,
        reviewDate: data.reviewDate,
        source: data.source,
        body: bodyValue,
        bodySource: inferBodySource(body),
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

export async function translateTextAction(
  text: string,
): Promise<{ en: string; fr: string; de: string }> {
  await verifySession();
  return translateToAllLocales(text);
}

export async function translateReviewAction(
  id: string,
  translations: { en: string; fr: string; de: string },
): Promise<void> {
  await verifySession();
  const db = getDb();
  const [row] = await db
    .select({ body: review.body })
    .from(review)
    .where(eq(review.id, id));
  if (!row) return;
  await db
    .update(review)
    .set({
      body: { ...row.body, ...translations },
      bodySource: { nl: "human", en: "machine", fr: "machine", de: "machine" },
    })
    .where(eq(review.id, id));
  invalidate();
}
