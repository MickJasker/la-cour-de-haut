"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { review } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifySession } from "@/lib/dal";
import { redirect } from "next/navigation";

const ReviewSchema = z.object({
  authorName: z.string().min(1),
  rating: z.coerce.number().int().min(1).max(5),
  reviewDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  source: z.enum(["airbnb", "natuurhuisje", "direct"]),
  body: z.string().min(1),
  published: z.coerce.boolean().optional().default(false),
  sortOrder: z.coerce.number().int().optional().default(0),
});

function invalidate() {
  revalidatePath("/admin/reviews");
  updateTag("reviews");
}

export async function createReviewAction(formData: FormData) {
  await verifySession();
  const parsed = ReviewSchema.parse({
    authorName: formData.get("authorName"),
    rating: formData.get("rating"),
    reviewDate: formData.get("reviewDate"),
    source: formData.get("source"),
    body: formData.get("body"),
    published: formData.get("published") === "on",
    sortOrder: formData.get("sortOrder") ?? 0,
  });

  const db = getDb();
  await db.insert(review).values({
    id: crypto.randomUUID(),
    authorName: parsed.authorName,
    rating: parsed.rating,
    reviewDate: parsed.reviewDate,
    source: parsed.source,
    body: { nl: parsed.body },
    bodySource: { nl: "human" },
    published: parsed.published,
    sortOrder: parsed.sortOrder,
  });

  invalidate();
  redirect("/admin/reviews");
}

export async function updateReviewAction(id: string, formData: FormData) {
  await verifySession();
  const parsed = ReviewSchema.parse({
    authorName: formData.get("authorName"),
    rating: formData.get("rating"),
    reviewDate: formData.get("reviewDate"),
    source: formData.get("source"),
    body: formData.get("body"),
    published: formData.get("published") === "on",
    sortOrder: formData.get("sortOrder") ?? 0,
  });

  const db = getDb();
  await db
    .update(review)
    .set({
      authorName: parsed.authorName,
      rating: parsed.rating,
      reviewDate: parsed.reviewDate,
      source: parsed.source,
      body: { nl: parsed.body },
      bodySource: { nl: "human" },
      published: parsed.published,
      sortOrder: parsed.sortOrder,
    })
    .where(eq(review.id, id));

  invalidate();
  redirect("/admin/reviews");
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
