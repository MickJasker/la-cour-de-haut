"use client";

import {
  initialFormState,
  mergeForm,
  revalidateLogic,
  useForm,
  useTransform,
} from "@tanstack/react-form-nextjs";
import { useActionState, useState, startTransition } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Field, FieldError, FieldGroup, FieldSet } from "@/components/ui/field";
import { TranslateDialog } from "@/components/translate-dialog";
import { ImageDropzone } from "../image-dropzone";
import {
  updateDescriptionAction,
  updateHeroDescriptionAction,
  uploadHeroImageAction,
  type ContentActionState,
  type UploadHeroActionState,
} from "./actions";
import { contentFormOpts, contentFormClientSchema } from "./shared";
import type { LocalizedText, LocalizedSource } from "@/db/schema";

const inputCls =
  "w-full rounded border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-y";

function LocalizedTextForm({
  id,
  initialValue,
  initialValueSource,
  action,
}: {
  id: string;
  initialValue: LocalizedText | null;
  initialValueSource: LocalizedSource | null;
  action: (prev: unknown, formData: FormData) => Promise<ContentActionState>;
}) {
  const [state, formAction, isPending] = useActionState<
    ContentActionState,
    FormData
  >(action, { ...initialFormState, success: false });

  const form = useForm({
    ...contentFormOpts,
    defaultValues: {
      nl: initialValue?.nl ?? "",
      en: initialValue?.en ?? "",
      fr: initialValue?.fr ?? "",
      de: initialValue?.de ?? "",
      enSource: (initialValueSource?.en ?? null) as "human" | "machine" | null,
      frSource: (initialValueSource?.fr ?? null) as "human" | "machine" | null,
      deSource: (initialValueSource?.de ?? null) as "human" | "machine" | null,
    },
    validators: { onDynamic: contentFormClientSchema },
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
      fd.set("nl", value.nl);
      fd.set("en", value.en ?? "");
      fd.set("fr", value.fr ?? "");
      fd.set("de", value.de ?? "");
      fd.set("enSource", value.enSource ?? "machine");
      fd.set("frSource", value.frSource ?? "machine");
      fd.set("deSource", value.deSource ?? "machine");
      startTransition(() => formAction(fd));
    },
  });

  return (
    <form
      id={id}
      noValidate
      className="space-y-4 border border-stone-200 rounded-lg p-5 bg-stone-50"
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      <FieldGroup>
        <FieldSet>
          <form.Field name="nl">
            {(field) => (
              <Field>
                <Label htmlFor={`${id}-nl`}>Beschrijving (NL)</Label>
                <textarea
                  id={`${id}-nl`}
                  rows={5}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  className={inputCls}
                />
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>
        </FieldSet>

        <FieldSet>
          <form.Subscribe
            selector={(s) => ({
              nl: s.values.nl,
              en: s.values.en,
              fr: s.values.fr,
              de: s.values.de,
            })}
          >
            {({ nl, en, fr, de }) => (
              <TranslateDialog
                mode="content"
                sourceText={nl}
                initialTranslations={{ en, fr, de }}
                onTranslated={(t) => {
                  if (form.getFieldValue("enSource") !== "human") {
                    form.setFieldValue("en", t.en);
                    form.setFieldValue("enSource", "machine");
                  }
                  if (form.getFieldValue("frSource") !== "human") {
                    form.setFieldValue("fr", t.fr);
                    form.setFieldValue("frSource", "machine");
                  }
                  if (form.getFieldValue("deSource") !== "human") {
                    form.setFieldValue("de", t.de);
                    form.setFieldValue("deSource", "machine");
                  }
                }}
                onLocaleEdited={(locale) => {
                  if (locale === "en") form.setFieldValue("enSource", "human");
                  else if (locale === "fr")
                    form.setFieldValue("frSource", "human");
                  else if (locale === "de")
                    form.setFieldValue("deSource", "human");
                }}
              />
            )}
          </form.Subscribe>
        </FieldSet>
      </FieldGroup>

      {typeof state.errorMap?.onServer === "string" && (
        <p className="text-destructive text-sm">{state.errorMap.onServer}</p>
      )}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Opslaan…" : "Opslaan"}
      </Button>
    </form>
  );
}

export function ContentClient({
  description,
  descriptionValueSource,
  heroDescription,
  heroDescriptionValueSource,
  heroImageUrl,
}: {
  description: LocalizedText | null;
  descriptionValueSource: LocalizedSource | null;
  heroDescription: LocalizedText | null;
  heroDescriptionValueSource: LocalizedSource | null;
  heroImageUrl: string | null;
}) {
  const [heroFile, setHeroFile] = useState<File | null>(null);
  const [uploadState, uploadAction, uploadPending] = useActionState<
    UploadHeroActionState | null,
    FormData
  >(uploadHeroImageAction, null);

  // Clear local file preview once upload completes so existingUrl takes over
  if (!uploadPending && uploadState?.success && heroFile) {
    setHeroFile(null);
  }

  function handleFileChange(file: File | null) {
    if (!file) return;
    setHeroFile(file);
    const fd = new FormData();
    fd.append("file", file);
    startTransition(() => uploadAction(fd));
  }

  return (
    <div className="space-y-12">
      {/* Hero */}
      <section data-testid="admin-hero-section" className="space-y-6">
        <h2 className="text-lg font-semibold">Hero</h2>

        <LocalizedTextForm
          id="hero-desc"
          initialValue={heroDescription}
          initialValueSource={heroDescriptionValueSource}
          action={updateHeroDescriptionAction}
        />

        <div className="border border-stone-200 rounded-lg p-5 bg-stone-50 space-y-4">
          <p className="text-sm font-medium text-stone-700">Afbeelding</p>
          <ImageDropzone
            file={heroFile}
            onChange={handleFileChange}
            existingUrl={heroImageUrl ?? undefined}
            testId="hero-file-input"
          />
          {uploadPending && (
            <p className="text-sm text-stone-500">Afbeelding uploaden…</p>
          )}
          {uploadState?.error && (
            <p className="text-sm text-red-600">{uploadState.error}</p>
          )}
        </div>
      </section>

      {/* Over de gîte */}
      <section data-testid="admin-gite-section" className="space-y-6">
        <h2 className="text-lg font-semibold">Over de gîte</h2>
        <LocalizedTextForm
          id="gite-desc"
          initialValue={description}
          initialValueSource={descriptionValueSource}
          action={updateDescriptionAction}
        />
      </section>
    </div>
  );
}
