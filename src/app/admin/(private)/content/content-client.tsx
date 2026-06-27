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
  uploadHeroImageAction,
  type ContentActionState,
  type UploadHeroActionState,
} from "./actions";
import type { LocalizedText } from "@/db/schema";

const inputCls =
  "w-full rounded border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-y";

export function ContentClient({
  description,
  heroImageUrl,
}: {
  description: LocalizedText | null;
  heroImageUrl: string | null;
}) {
  const [state, formAction, isPending] = useActionState<
    ContentActionState | null,
    FormData
  >(updateDescriptionAction, null);

  const [uploadState, uploadAction, uploadPending] = useActionState<
    UploadHeroActionState | null,
    FormData
  >(uploadHeroImageAction, null);

  const [nl, setNl] = useState(description?.nl ?? "");
  const [en, setEn] = useState(description?.en ?? "");
  const [fr, setFr] = useState(description?.fr ?? "");
  const [de, setDe] = useState(description?.de ?? "");

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    React.startTransition(() => uploadAction(fd));
  }

  return (
    <div className="space-y-12">
      {/* Description */}
      <section className="space-y-6">
        <h2 className="text-lg font-semibold">Beschrijving</h2>
        <form
          action={formAction}
          className="space-y-4 border border-stone-200 rounded-lg p-5 bg-stone-50"
        >
          <FieldGroup>
            <FieldSet>
              <Field>
                <Label htmlFor="descriptionNl">Beschrijving (NL)</Label>
                <textarea
                  id="descriptionNl"
                  name="descriptionNl"
                  rows={6}
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

            <FieldSet>
              <Field>
                <Label
                  htmlFor="descriptionEn"
                  className="text-xs uppercase tracking-wide text-stone-500"
                >
                  EN
                </Label>
                <textarea
                  id="descriptionEn"
                  name="descriptionEn"
                  rows={4}
                  value={en}
                  onChange={(e) => setEn(e.target.value)}
                  className={inputCls}
                />
              </Field>
            </FieldSet>

            <FieldSet>
              <Field>
                <Label
                  htmlFor="descriptionFr"
                  className="text-xs uppercase tracking-wide text-stone-500"
                >
                  FR
                </Label>
                <textarea
                  id="descriptionFr"
                  name="descriptionFr"
                  rows={4}
                  value={fr}
                  onChange={(e) => setFr(e.target.value)}
                  className={inputCls}
                />
              </Field>
            </FieldSet>

            <FieldSet>
              <Field>
                <Label
                  htmlFor="descriptionDe"
                  className="text-xs uppercase tracking-wide text-stone-500"
                >
                  DE
                </Label>
                <textarea
                  id="descriptionDe"
                  name="descriptionDe"
                  rows={4}
                  value={de}
                  onChange={(e) => setDe(e.target.value)}
                  className={inputCls}
                />
              </Field>
            </FieldSet>
          </FieldGroup>

          <Button type="submit" disabled={isPending}>
            {isPending ? "Opslaan…" : "Opslaan"}
          </Button>
        </form>
      </section>

      {/* Hero image */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Hero afbeelding</h2>
        <div className="border border-stone-200 rounded-lg p-5 bg-stone-50 space-y-4">
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
    </div>
  );
}
