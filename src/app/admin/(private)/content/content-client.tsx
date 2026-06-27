"use client";

import * as React from "react";
import { useActionState, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Field, FieldError, FieldGroup, FieldSet } from "@/components/ui/field";
import { TranslateDialog } from "@/components/translate-dialog";
import {
  updateDescriptionAction,
  updateHeroDescriptionAction,
  uploadHeroImageAction,
  type ContentActionState,
  type UploadHeroActionState,
} from "./actions";
import type { LocalizedText } from "@/db/schema";

const inputCls =
  "w-full rounded border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-y";

function LocalizedTextForm({
  id,
  initialValue,
  action,
}: {
  id: string;
  initialValue: LocalizedText | null;
  action: (
    prev: ContentActionState | null,
    formData: FormData,
  ) => Promise<ContentActionState>;
}) {
  const [state, formAction, isPending] = useActionState<
    ContentActionState | null,
    FormData
  >(action, null);

  const [nl, setNl] = useState(initialValue?.nl ?? "");
  const [en, setEn] = useState(initialValue?.en ?? "");
  const [fr, setFr] = useState(initialValue?.fr ?? "");
  const [de, setDe] = useState(initialValue?.de ?? "");

  return (
    <form
      action={formAction}
      className="space-y-4 border border-stone-200 rounded-lg p-5 bg-stone-50"
    >
      <FieldGroup>
        <FieldSet>
          <Field>
            <Label htmlFor={`${id}-nl`}>Beschrijving (NL)</Label>
            <textarea
              id={`${id}-nl`}
              name="descriptionNl"
              rows={5}
              value={nl}
              onChange={(e) => setNl(e.target.value)}
              className={inputCls}
            />
            {state?.errors?.descriptionNl && (
              <FieldError errors={[state.errors.descriptionNl]} />
            )}
          </Field>
        </FieldSet>

        <FieldSet>
          <TranslateDialog
            mode="content"
            sourceText={nl}
            onTranslated={(t) => {
              setEn(t.en);
              setFr(t.fr);
              setDe(t.de);
            }}
          />
        </FieldSet>

        {(
          [
            { label: "EN", fieldName: "descriptionEn", value: en, set: setEn },
            { label: "FR", fieldName: "descriptionFr", value: fr, set: setFr },
            { label: "DE", fieldName: "descriptionDe", value: de, set: setDe },
          ] as const
        ).map(({ label, fieldName, value, set }) => (
          <FieldSet key={fieldName}>
            <Field>
              <Label
                htmlFor={`${id}-${fieldName}`}
                className="text-xs uppercase tracking-wide text-stone-500"
              >
                {label}
              </Label>
              <textarea
                id={`${id}-${fieldName}`}
                name={fieldName}
                rows={4}
                value={value}
                onChange={(e) => set(e.target.value)}
                className={inputCls}
              />
            </Field>
          </FieldSet>
        ))}
      </FieldGroup>

      <Button type="submit" disabled={isPending}>
        {isPending ? "Opslaan…" : "Opslaan"}
      </Button>
    </form>
  );
}

export function ContentClient({
  description,
  heroDescription,
  heroImageUrl,
}: {
  description: LocalizedText | null;
  heroDescription: LocalizedText | null;
  heroImageUrl: string | null;
}) {
  const [uploadState, uploadAction, uploadPending] = useActionState<
    UploadHeroActionState | null,
    FormData
  >(uploadHeroImageAction, null);

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    React.startTransition(() => uploadAction(fd));
  }

  return (
    <div className="space-y-12">
      {/* Hero */}
      <section data-testid="admin-hero-section" className="space-y-6">
        <h2 className="text-lg font-semibold">Hero</h2>

        <LocalizedTextForm
          id="hero-desc"
          initialValue={heroDescription}
          action={updateHeroDescriptionAction}
        />

        <div className="border border-stone-200 rounded-lg p-5 bg-stone-50 space-y-4">
          <p className="text-sm font-medium text-stone-700">Afbeelding</p>
          {heroImageUrl && (
            <div className="relative w-full aspect-video max-w-md">
              <Image
                src={heroImageUrl}
                alt="Huidige hero afbeelding"
                fill
                className="object-cover rounded"
                sizes="(max-width: 768px) 100vw, 448px"
              />
            </div>
          )}
          <label className="block">
            <span className="sr-only">Hero afbeelding uploaden</span>
            <input
              data-testid="hero-file-input"
              type="file"
              accept="image/*"
              disabled={uploadPending}
              onChange={handleImageChange}
              className="block text-sm text-stone-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-stone-100 file:text-stone-700 hover:file:bg-stone-200"
            />
          </label>
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
          action={updateDescriptionAction}
        />
      </section>
    </div>
  );
}
