"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldSet } from "@/components/ui/field";
import { StarPicker } from "./star-picker";
import { createReviewAction, updateReviewAction } from "./actions";
import type { review } from "@/db/schema";

type Review = typeof review.$inferSelect;

const inputClass =
  "flex h-9 w-full rounded-lg border border-input bg-cream-50 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

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
    <form onSubmit={handleSubmit} noValidate>
      <FieldGroup>
        <FieldSet>
          <Field>
            <Label htmlFor="authorName">Author name</Label>
            <Input
              id="authorName"
              name="authorName"
              required
              defaultValue={existing?.authorName}
              placeholder="e.g. Marie D."
            />
          </Field>
        </FieldSet>

        <FieldSet>
          <Field>
            <Label>Rating</Label>
            <StarPicker defaultValue={existing?.rating ?? 5} />
          </Field>
        </FieldSet>

        <FieldSet>
          <Field>
            <Label htmlFor="reviewDate">Review date</Label>
            <Input
              id="reviewDate"
              name="reviewDate"
              type="date"
              required
              defaultValue={existing?.reviewDate}
            />
          </Field>
        </FieldSet>

        <FieldSet>
          <Field>
            <Label htmlFor="source">Source</Label>
            <select
              id="source"
              name="source"
              defaultValue={existing?.source ?? "airbnb"}
              className={inputClass}
            >
              <option value="airbnb">AirBnB</option>
              <option value="natuurhuisje">Natuurhuisje</option>
              <option value="direct">direct</option>
            </select>
          </Field>
        </FieldSet>

        <FieldSet>
          <Field>
            <Label htmlFor="body">Review text (NL)</Label>
            <textarea
              id="body"
              name="body"
              required
              rows={5}
              defaultValue={existing?.body?.nl}
              placeholder="Paste the review text here…"
              className={`${inputClass} h-auto resize-y`}
            />
          </Field>
        </FieldSet>

        <FieldSet>
          <Field>
            <div className="flex items-center gap-2">
              <Checkbox
                id="published"
                name="published"
                defaultChecked={existing?.published ?? false}
              />
              <Label htmlFor="published">Published</Label>
            </div>
          </Field>
        </FieldSet>

        <FieldSet>
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
        </FieldSet>
      </FieldGroup>
    </form>
  );
}
