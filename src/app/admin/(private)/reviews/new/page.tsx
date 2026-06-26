import { ReviewForm } from "../review-form";

export default function NewReviewPage() {
  return (
    <main className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto space-y-10">
        <h1 className="text-2xl font-semibold">Beoordeling toevoegen</h1>
        <ReviewForm />
      </div>
    </main>
  );
}
