"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  translateTextAction,
  translateReviewAction,
} from "@/app/admin/(private)/reviews/actions";
import { translatePoiAction } from "@/app/admin/(private)/pois/actions";

type Translations = { en: string; fr: string; de: string };
type PoiTranslations = {
  title: Translations;
  body: Translations;
};

type ReviewTranslateDialogProps = {
  mode: "review";
  reviewId?: string;
  sourceText: string;
  onTranslated?: (translations: Translations) => void;
};

type PoiTranslateDialogProps = {
  mode: "poi";
  poiId?: string;
  sourceTitleText: string;
  sourceBodyText: string;
  onTranslated?: (translations: PoiTranslations) => void;
};

type TranslateDialogProps =
  | ReviewTranslateDialogProps
  | PoiTranslateDialogProps;

const textareaCls =
  "w-full rounded border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-y";

function LangFields({
  prefix,
  values,
  onChange,
}: {
  prefix: string;
  values: Translations;
  onChange: (next: Translations) => void;
}) {
  return (
    <div className="space-y-3">
      {(["en", "fr", "de"] as const).map((lang) => (
        <div key={lang}>
          <Label
            htmlFor={`${prefix}-${lang}`}
            className="mb-1 block text-xs uppercase tracking-wide text-stone-500"
          >
            {lang.toUpperCase()}
          </Label>
          <textarea
            id={`${prefix}-${lang}`}
            rows={3}
            value={values[lang]}
            onChange={(e) => onChange({ ...values, [lang]: e.target.value })}
            className={textareaCls}
          />
        </div>
      ))}
    </div>
  );
}

export function TranslateDialog(props: TranslateDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Review state
  const [reviewTranslations, setReviewTranslations] = useState<Translations>({
    en: "",
    fr: "",
    de: "",
  });

  // POI state
  const [poiTitle, setPoiTitle] = useState<Translations>({
    en: "",
    fr: "",
    de: "",
  });
  const [poiBody, setPoiBody] = useState<Translations>({
    en: "",
    fr: "",
    de: "",
  });

  const canTranslate =
    props.mode === "review"
      ? props.sourceText.trim().length > 0
      : props.sourceTitleText.trim().length > 0 ||
        props.sourceBodyText.trim().length > 0;

  function handleFetch() {
    startTransition(async () => {
      if (props.mode === "review") {
        const result = await translateTextAction(props.sourceText);
        setReviewTranslations(result);
      } else {
        const hasTitle = props.sourceTitleText.trim().length > 0;
        const hasBody = props.sourceBodyText.trim().length > 0;
        const [titleResult, bodyResult] = await Promise.all([
          hasTitle ? translateTextAction(props.sourceTitleText) : null,
          hasBody ? translateTextAction(props.sourceBodyText) : null,
        ]);
        if (titleResult) setPoiTitle(titleResult);
        if (bodyResult) setPoiBody(bodyResult);
      }
    });
  }

  function handleConfirm() {
    startTransition(async () => {
      if (props.mode === "review") {
        if (props.reviewId) {
          await translateReviewAction(props.reviewId, reviewTranslations);
        } else {
          props.onTranslated?.(reviewTranslations);
        }
      } else {
        if (props.poiId) {
          await translatePoiAction(props.poiId, {
            title: poiTitle,
            body: poiBody,
          });
        } else {
          props.onTranslated?.({ title: poiTitle, body: poiBody });
        }
      }
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="secondary">
          Automatisch vertalen
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Vertalen</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <Button
            type="button"
            variant="secondary"
            disabled={!canTranslate || isPending}
            onClick={handleFetch}
          >
            {isPending ? "Bezig met vertalen…" : "Vertalen"}
          </Button>

          {props.mode === "review" ? (
            <LangFields
              prefix="review"
              values={reviewTranslations}
              onChange={setReviewTranslations}
            />
          ) : (
            <>
              <div>
                <p className="mb-2 text-sm font-semibold text-stone-700">
                  Titel
                </p>
                <LangFields
                  prefix="poi-title"
                  values={poiTitle}
                  onChange={setPoiTitle}
                />
              </div>
              <div>
                <p className="mb-2 text-sm font-semibold text-stone-700">
                  Beschrijving
                </p>
                <LangFields
                  prefix="poi-body"
                  values={poiBody}
                  onChange={setPoiBody}
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Annuleren
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={isPending}>
            {isPending ? "Opslaan…" : "Opslaan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
