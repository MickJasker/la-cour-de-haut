import { getDb } from "@/db";
import { review } from "@/db/schema";
import { asc } from "drizzle-orm";
import { ReviewsList } from "./reviews-client";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function AdminReviewsPage() {
  const db = getDb();
  const reviews = await db
    .select()
    .from(review)
    .orderBy(asc(review.sortOrder), asc(review.createdAt));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Reviews</h1>
        <Button asChild>
          <Link href="/admin/reviews/new">Add review</Link>
        </Button>
      </div>
      <ReviewsList reviews={reviews} />
    </div>
  );
}
