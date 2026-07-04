"use client";

import { useActionState, useState, startTransition } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Field, FieldGroup, FieldSet } from "@/components/ui/field";
import { LocaleStatus } from "@/components/locale-status";
import { RichTextEditor } from "@/components/rich-text-editor";
import { EMPTY_EDITOR_STATE } from "@/lib/content/lexical/empty-state";
import { ImageDropzone } from "../image-dropzone";
import { uploadAdminImage } from "../upload-image";
import {
  updateAboutUsDescriptionAction,
  updateDescriptionAction,
  updateHeroDescriptionAction,
  uploadHeroImageAction,
  type ContentActionState,
  type UploadHeroActionState,
} from "./actions";
import type { LocalizedEditorState, LocalizedSource } from "@/db/schema";

/** "Basic prose" (bold/italic/paragraphs/links) editor form for a single
 * content_block row (ADR-0017). No TanStack form — the rich value is opaque
 * EditorState JSON, kept as component state and attached to FormData on
 * submit, like POI detail's editor (ADR-0015). The wire format is the
 * localized `{ nl, en?, fr?, de? }` shape shared with the POI form — see
 * `parseDetailField` (`@/lib/lexical/parse-detail-field`). */
function RichTextBlockForm({
  id,
  label,
  initialValue,
  initialValueSource,
  action,
}: {
  id: string;
  label: string;
  initialValue: LocalizedEditorState | null;
  initialValueSource: LocalizedSource | null;
  action: (prev: unknown, formData: FormData) => Promise<ContentActionState>;
}) {
  const [state, formAction, isPending] = useActionState<
    ContentActionState,
    FormData
  >(action, { success: false, error: null });

  const [detail, setDetail] = useState<LocalizedEditorState>(
    initialValue ?? { nl: EMPTY_EDITOR_STATE },
  );

  return (
    <form
      id={id}
      className="space-y-4 border border-stone-200 rounded-lg p-5 bg-stone-50"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData();
        fd.set("detail", JSON.stringify(detail));
        startTransition(() => formAction(fd));
      }}
    >
      <FieldGroup>
        <FieldSet>
          <Field>
            <Label>{label}</Label>
            <RichTextEditor
              initialValue={detail.nl}
              onChange={(nl) => setDetail((d) => ({ ...d, nl }))}
              ariaLabel={label}
              variant="basic"
            />
          </Field>
        </FieldSet>
      </FieldGroup>

      {state.error && <p className="text-destructive text-sm">{state.error}</p>}

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
  aboutUsDescription,
  aboutUsDescriptionValueSource,
}: {
  description: LocalizedEditorState | null;
  descriptionValueSource: LocalizedSource | null;
  heroDescription: LocalizedEditorState | null;
  heroDescriptionValueSource: LocalizedSource | null;
  heroImageUrl: string | null;
  aboutUsDescription: LocalizedEditorState | null;
  aboutUsDescriptionValueSource: LocalizedSource | null;
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

        <RichTextBlockForm
          id="hero-desc"
          label="Beschrijving (NL)"
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
        <RichTextBlockForm
          id="gite-desc"
          label="Beschrijving (NL)"
          initialValue={description}
          initialValueSource={descriptionValueSource}
          action={updateDescriptionAction}
        />
      </section>

      {/* Over René en Yvonne */}
      <section data-testid="admin-about-us-section" className="space-y-6">
        <h2 className="text-lg font-semibold">Over René en Yvonne</h2>
        <RichTextBlockForm
          id="about-us-desc"
          label="Beschrijving (NL)"
          initialValue={aboutUsDescription}
          initialValueSource={aboutUsDescriptionValueSource}
          action={updateAboutUsDescriptionAction}
        />
      </section>
    </div>
  );
}
