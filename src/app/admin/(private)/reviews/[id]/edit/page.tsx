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
    <main className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto space-y-10">
        <h1 className="text-2xl font-semibold">Beoordeling bewerken</h1>
        <ReviewForm existing={existing} />
      </div>
    </main>
  );
}
