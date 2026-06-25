"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { StarPicker } from "./star-picker";
import { createReviewAction, updateReviewAction } from "./actions";
import type { review } from "@/db/schema";

type Review = typeof review.$inferSelect;

export function ReviewForm({ existing }: { existing?: Review }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      if (existing) {
        await updateReviewAction(existing.id, formData);
      } else {
        await createReviewAction(formData);
      }
      router.push("/admin/reviews");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-lg">
      <div className="space-y-1">
        <Label htmlFor="authorName">Author name</Label>
        <input
          id="authorName"
          name="authorName"
          required
          defaultValue={existing?.authorName}
          className="w-full border border-stone-300 rounded px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-1">
        <Label>Rating</Label>
        <StarPicker defaultValue={existing?.rating ?? 5} />
      </div>

      <div className="space-y-1">
        <Label htmlFor="reviewDate">Review date</Label>
        <input
          id="reviewDate"
          name="reviewDate"
          type="date"
          required
          defaultValue={existing?.reviewDate}
          className="border border-stone-300 rounded px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="source">Source</Label>
        <select
          id="source"
          name="source"
          defaultValue={existing?.source ?? "airbnb"}
          className="w-full border border-stone-300 rounded px-3 py-2 text-sm"
        >
          <option value="airbnb">AirBnB</option>
          <option value="natuurhuisje">Natuurhuisje</option>
          <option value="direct">direct</option>
        </select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="body">Review text (NL)</Label>
        <textarea
          id="body"
          name="body"
          required
          rows={5}
          defaultValue={existing?.body?.nl}
          className="w-full border border-stone-300 rounded px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="sortOrder">Sort order</Label>
        <input
          id="sortOrder"
          name="sortOrder"
          type="number"
          defaultValue={existing?.sortOrder ?? 0}
          className="w-24 border border-stone-300 rounded px-3 py-2 text-sm"
        />
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="published"
          name="published"
          defaultChecked={existing?.published ?? false}
        />
        <Label htmlFor="published">Published</Label>
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : "Save"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.push("/admin/reviews")}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
