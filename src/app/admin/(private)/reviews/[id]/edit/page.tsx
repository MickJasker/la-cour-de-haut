import { getDb } from "@/db";
import { review } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ReviewForm } from "../../review-form";

export default async function EditReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDb();
  const [existing] = await db
    .select()
    .from(review)
    .where(eq(review.id, id))
    .limit(1);

  if (!existing) notFound();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Edit review</h1>
      <ReviewForm existing={existing} />
    </div>
  );
}
