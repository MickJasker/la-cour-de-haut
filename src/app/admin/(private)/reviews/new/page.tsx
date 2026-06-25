import { ReviewForm } from "../review-form";

export default function NewReviewPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Add review</h1>
      <ReviewForm />
    </div>
  );
}
