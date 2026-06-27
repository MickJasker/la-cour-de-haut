"use client";

import {
  initialFormState,
  mergeForm,
  revalidateLogic,
  useForm,
  useTransform,
} from "@tanstack/react-form-nextjs";
import { useActionState, useEffect, startTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Field, FieldError, FieldGroup, FieldSet } from "@/components/ui/field";
import { StarPicker } from "./star-picker";
import { DatePicker } from "./date-picker";
import {
  createReviewAction,
  updateReviewAction,
  type ReviewActionState,
} from "./actions";
import { reviewFormOpts, reviewFormClientSchema } from "./shared";
import { TranslateDialog } from "@/components/translate-dialog";
import type { review } from "@/db/schema";

type Review = typeof review.$inferSelect;

const inputClass =
  "flex h-9 w-full rounded-lg border border-input bg-cream-50 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

export function ReviewForm({ existing }: { existing?: Review }) {
  const router = useRouter();

  const boundAction = existing
    ? updateReviewAction.bind(null, existing.id)
    : createReviewAction;

  const [state, formAction, isPending] = useActionState<
    ReviewActionState,
    FormData
  >(boundAction, { ...initialFormState, success: false });

  const defaults = existing
    ? {
        authorName: existing.authorName,
        rating: existing.rating,
        reviewDate: existing.reviewDate,
        source: existing.source as "airbnb" | "natuurhuisje" | "direct",
        body: existing.body ?? { nl: "" },
        published: existing.published,
      }
    : undefined;

  const form = useForm({
    ...reviewFormOpts,
    ...(defaults ? { defaultValues: defaults } : {}),
    validators: { onDynamic: reviewFormClientSchema },
    validationLogic: revalidateLogic({
      mode: "submit",
      modeAfterSubmission: "change",
    }),
    transform: useTransform(
      (baseForm) =>
        state.values !== undefined ? mergeForm(baseForm, state) : baseForm,
      [state],
    ),
    onSubmit: ({ value }) => {
      const fd = new FormData();
      fd.set("authorName", value.authorName);
      fd.set("rating", String(value.rating));
      fd.set("reviewDate", value.reviewDate);
      fd.set("source", value.source);
      fd.set("body", JSON.stringify(value.body));
      fd.set("published", String(value.published));
      startTransition(() => formAction(fd));
    },
  });

  useEffect(() => {
    if (state.success) router.push("/admin/reviews");
  }, [state.success, router]);

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      <FieldGroup>
        <FieldSet>
          <form.Field name="authorName">
            {(field) => (
              <Field data-field="authorName">
                <Label htmlFor="authorName">Auteur</Label>
                <Input
                  id="authorName"
                  name={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder="e.g. Marie D."
                />
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>
        </FieldSet>

        <FieldSet>
          <form.Field name="rating">
            {(field) => (
              <Field data-field="rating">
                <Label>Beoordeling</Label>
                <input
                  type="hidden"
                  name={field.name}
                  value={field.state.value}
                />
                <StarPicker
                  value={field.state.value}
                  onChange={(v) => field.handleChange(v)}
                />
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>
        </FieldSet>

        <FieldSet>
          <form.Field name="reviewDate">
            {(field) => (
              <Field data-field="reviewDate">
                <Label>Beoordelingsdatum</Label>
                <input
                  type="hidden"
                  name={field.name}
                  value={field.state.value}
                />
                <DatePicker
                  value={field.state.value}
                  onChange={(v) => field.handleChange(v)}
                />
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>
        </FieldSet>

        <FieldSet>
          <form.Field name="source">
            {(field) => (
              <Field data-field="source">
                <Label htmlFor="source">Bron</Label>
                <select
                  id="source"
                  name={field.name}
                  value={field.state.value}
                  onChange={(e) =>
                    field.handleChange(
                      e.target.value as "airbnb" | "natuurhuisje" | "direct",
                    )
                  }
                  onBlur={field.handleBlur}
                  className={inputClass}
                >
                  <option value="airbnb">AirBnB</option>
                  <option value="natuurhuisje">Natuurhuisje</option>
                  <option value="direct">direct</option>
                </select>
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>
        </FieldSet>

        <FieldSet>
          <form.Field name="body.nl">
            {(field) => (
              <Field data-field="body">
                <Label htmlFor="body">Recensie</Label>
                <textarea
                  id="body"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  rows={5}
                  placeholder="Plak de recensietekst hier…"
                  className={`${inputClass} h-auto resize-y`}
                />
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>
        </FieldSet>

        <FieldSet>
          <form.Field name="published">
            {(field) => (
              <Field data-field="published">
                <input
                  type="hidden"
                  name={field.name}
                  value={String(field.state.value)}
                />
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="published"
                    checked={field.state.value}
                    onCheckedChange={(checked) =>
                      field.handleChange(checked === true)
                    }
                  />
                  <Label htmlFor="published">Gepubliceerd</Label>
                </div>
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>
        </FieldSet>

        <FieldSet>
          <form.Subscribe selector={(s) => s.values.body}>
            {(body) => (
              <TranslateDialog
                mode="review"
                reviewId={existing?.id}
                sourceText={body.nl}
                onTranslated={(t) => {
                  const current = form.getFieldValue("body");
                  form.setFieldValue("body", { ...current, ...t });
                }}
              />
            )}
          </form.Subscribe>
        </FieldSet>

        <FieldSet>
          <div className="flex gap-3">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Opslaan…" : "Opslaan"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push("/admin/reviews")}
            >
              Annuleren
            </Button>
          </div>
        </FieldSet>
      </FieldGroup>
    </form>
  );
}
