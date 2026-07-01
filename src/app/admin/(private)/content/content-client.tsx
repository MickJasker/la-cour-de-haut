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
import { LocaleStatus } from "@/components/locale-status";
import { ImageDropzone } from "../image-dropzone";
import { uploadAdminImage } from "../upload-image";
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
      </FieldGroup>

      {typeof state.errorMap?.onServer === "string" && (
        <p className="text-destructive text-sm">{state.errorMap.onServer}</p>
      )}

      {state.failures?.length ? (
        <p className="text-sm text-amber-700">
          Vertaling naar {state.failures.join(", ")} is mislukt — opnieuw
          geprobeerd bij volgende opslag.
        </p>
      ) : null}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Opslaan en vertalen…" : "Opslaan"}
      </Button>

      <LocaleStatus source={initialValueSource ?? { nl: "human" }} />
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
  // Tracks the direct-to-Blob upload (browser -> Vercel Blob), which happens
  // before the action runs, so "Afbeelding uploaden…" stays visible for the
  // whole operation, not just the action round-trip. See #98.
  const [isUploadingToBlob, setIsUploadingToBlob] = useState(false);
  const [blobUploadError, setBlobUploadError] = useState<string | null>(null);
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
    void (async () => {
      setIsUploadingToBlob(true);
      setBlobUploadError(null);
      try {
        // The file streams straight from the browser to Vercel Blob; the
        // action only ever receives the resulting URL string. See #98.
        const imageUrl = await uploadAdminImage(file, "content");
        const fd = new FormData();
        fd.append("imageUrl", imageUrl);
        startTransition(() => uploadAction(fd));
        // React Compiler can't lower a try/catch/finally together (only
        // try/catch), so the "stop uploading" call is duplicated at the end
        // of both the try and catch bodies instead of a shared finally.
        setIsUploadingToBlob(false);
      } catch (error) {
        setBlobUploadError(
          error instanceof Error
            ? error.message
            : "Afbeelding uploaden mislukt",
        );
        setIsUploadingToBlob(false);
      }
    })();
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
          {(isUploadingToBlob || uploadPending) && (
            <p className="text-sm text-stone-500">Afbeelding uploaden…</p>
          )}
          {(blobUploadError ?? uploadState?.error) && (
            <p className="text-sm text-red-600">
              {blobUploadError ?? uploadState?.error}
            </p>
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
