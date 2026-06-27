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

export async function createReviewAction(
  _prev: unknown,
  formData: FormData,
): Promise<ReviewActionState> {
  await verifySession();
  try {
    const data = await serverValidate(formData);
    const db = getDb();
    await db.insert(review).values({
      id: crypto.randomUUID(),
      authorName: data.authorName,
      rating: data.rating,
      reviewDate: data.reviewDate,
      source: data.source,
      body: { nl: data.body },
      bodySource: { nl: "human" },
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
    const db = getDb();
    await db
      .update(review)
      .set({
        authorName: data.authorName,
        rating: data.rating,
        reviewDate: data.reviewDate,
        source: data.source,
        body: { nl: data.body },
        bodySource: { nl: "human" },
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
