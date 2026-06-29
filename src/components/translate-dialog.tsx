"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { SerializedEditorState } from "lexical";
import {
  translateTextAction,
  translateReviewTextAction,
  translateReviewAction,
} from "@/app/admin/(private)/reviews/actions";
import { translatePoiAction } from "@/app/admin/(private)/pois/actions";
import {
  translatePoiDetailAction,
  persistPoiDetailTranslationAction,
  type PoiDetailTranslations,
} from "@/app/admin/(private)/pois/detail-translate-action";
import { hasEditorText } from "@/lib/lexical/empty-state";

type Translations = { en: string; fr: string; de: string };
type ReviewMap = { nl?: string; en?: string; fr?: string; de?: string };
type PoiTranslations = {
  title: Translations;
  body: Translations;
  detail?: PoiDetailTranslations;
};

type ReviewTranslateDialogProps = {
  mode: "review";
  reviewId?: string;
  sourceText: string;
  sourceLocale: string;
  onTranslated?: (payload: {
    detectedSource: string;
    translations: ReviewMap;
  }) => void;
};

type PoiTranslateDialogProps = {
  mode: "poi";
  poiId?: string;
  sourceTitleText: string;
  sourceBodyText: string;
  sourceDetailState?: SerializedEditorState;
  onTranslated?: (translations: PoiTranslations) => void;
};

type ContentTranslateDialogProps = {
  mode: "content";
  sourceText: string;
  initialTranslations?: { en?: string; fr?: string; de?: string };
  onTranslated?: (translations: Translations) => void;
  onLocaleEdited?: (locale: "en" | "fr" | "de") => void;
};

type TranslateDialogProps =
  | ReviewTranslateDialogProps
  | PoiTranslateDialogProps
  | ContentTranslateDialogProps;

const textareaCls =
  "w-full rounded border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-y";

function LangFields({
  prefix,
  values,
  onChange,
  onUserEdit,
}: {
  prefix: string;
  values: Translations;
  onChange: (next: Translations) => void;
  onUserEdit?: (lang: "en" | "fr" | "de") => void;
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
            onChange={(e) => {
              onChange({ ...values, [lang]: e.target.value });
              onUserEdit?.(lang);
            }}
            className={textareaCls}
          />
        </div>
      ))}
    </div>
  );
}

// Reviews translate outward from an arbitrary source locale, so the editable
// slots are whichever display locales the machine produced — not a fixed trio.
function ReviewLangFields({
  values,
  onChange,
}: {
  values: ReviewMap;
  onChange: (next: ReviewMap) => void;
}) {
  const langs = (["nl", "en", "fr", "de"] as const).filter(
    (l) => values[l] !== undefined,
  );
  if (langs.length === 0) return null;
  return (
    <div className="space-y-3">
      {langs.map((lang) => (
        <div key={lang}>
          <Label
            htmlFor={`review-${lang}`}
            className="mb-1 block text-xs uppercase tracking-wide text-stone-500"
          >
            {lang.toUpperCase()}
          </Label>
          <textarea
            id={`review-${lang}`}
            rows={3}
            value={values[lang] ?? ""}
            onChange={(e) => onChange({ ...values, [lang]: e.target.value })}
            className={textareaCls}
          />
        </div>
      ))}
    </div>
  );
}

function TranslateDialogInner(props: TranslateDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Content state (authored content: fixed en/fr/de)
  const [reviewTranslations, setReviewTranslations] = useState<Translations>(
    props.mode === "content"
      ? {
          en: props.initialTranslations?.en ?? "",
          fr: props.initialTranslations?.fr ?? "",
          de: props.initialTranslations?.de ?? "",
        }
      : { en: "", fr: "", de: "" },
  );

  // Review state (source-aware: dynamic display locales + detected source)
  const [reviewMap, setReviewMap] = useState<ReviewMap>({});
  const [detectedSource, setDetectedSource] = useState<string>(
    props.mode === "review" ? props.sourceLocale : "",
  );

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
  const [poiDetail, setPoiDetail] = useState<PoiDetailTranslations | null>(
    null,
  );

  const poiHasDetail =
    props.mode === "poi" && props.sourceDetailState
      ? hasEditorText(props.sourceDetailState)
      : false;

  const canTranslate =
    props.mode === "review" || props.mode === "content"
      ? props.sourceText.trim().length > 0
      : props.sourceTitleText.trim().length > 0 ||
        props.sourceBodyText.trim().length > 0 ||
        poiHasDetail;

  function handleFetch() {
    setFetchError(null);
    startTransition(async () => {
      try {
        if (props.mode === "review") {
          const { detectedSource: ds, translations } =
            await translateReviewTextAction(
              props.sourceText,
              props.sourceLocale,
            );
          setDetectedSource(ds);
          setReviewMap(translations);
        } else if (props.mode === "content") {
          const result = await translateTextAction(props.sourceText);
          setReviewTranslations(result);
        } else {
          const hasTitle = props.sourceTitleText.trim().length > 0;
          const hasBody = props.sourceBodyText.trim().length > 0;
          const detailState = props.sourceDetailState;
          const hasDetail = detailState ? hasEditorText(detailState) : false;
          const [titleResult, bodyResult, detailResult] = await Promise.all([
            hasTitle ? translateTextAction(props.sourceTitleText) : null,
            hasBody ? translateTextAction(props.sourceBodyText) : null,
            hasDetail && detailState
              ? translatePoiDetailAction(detailState)
              : null,
          ]);
          if (titleResult) setPoiTitle(titleResult);
          if (bodyResult) setPoiBody(bodyResult);
          if (detailResult) setPoiDetail(detailResult);
        }
      } catch {
        setFetchError("Vertalen mislukt. Probeer het opnieuw.");
      }
    });
  }

  function handleConfirm() {
    startTransition(async () => {
      if (props.mode === "review") {
        // Nothing fetched yet → don't overwrite existing translations or the
        // stored original_locale with an empty/undetected result.
        if (Object.keys(reviewMap).length === 0) {
          setOpen(false);
          return;
        }
        if (props.reviewId) {
          await translateReviewAction(props.reviewId, {
            sourceLocale: detectedSource,
            translations: reviewMap,
          });
        } else {
          props.onTranslated?.({ detectedSource, translations: reviewMap });
        }
      } else if (props.mode === "content") {
        props.onTranslated?.(reviewTranslations);
      } else {
        if (props.poiId) {
          await translatePoiAction(props.poiId, {
            title: poiTitle,
            body: poiBody,
          });
          if (poiDetail) {
            await persistPoiDetailTranslationAction(props.poiId, poiDetail);
          }
        } else {
          props.onTranslated?.({
            title: poiTitle,
            body: poiBody,
            detail: poiDetail ?? undefined,
          });
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
          <DialogDescription className="sr-only">
            Genereer en bewerk automatische vertalingen voor alle talen.
          </DialogDescription>
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

          {fetchError && (
            <p className="text-sm text-destructive">{fetchError}</p>
          )}

          {props.mode === "review" ? (
            <ReviewLangFields values={reviewMap} onChange={setReviewMap} />
          ) : props.mode === "content" ? (
            <LangFields
              prefix="review"
              values={reviewTranslations}
              onChange={setReviewTranslations}
              onUserEdit={props.onLocaleEdited}
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
              {poiHasDetail && (
                <div>
                  <p className="mb-1 text-sm font-semibold text-stone-700">
                    Detailtekst
                  </p>
                  <p className="text-xs text-stone-500">
                    {poiDetail
                      ? "Rijke tekst vertaald naar EN/FR/DE."
                      : "Rijke tekst wordt automatisch meevertaald naar EN/FR/DE."}
                  </p>
                </div>
              )}
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

export function TranslateDialog(props: TranslateDialogProps) {
  const key =
    props.mode === "content"
      ? `${props.initialTranslations?.en ?? ""}|${props.initialTranslations?.fr ?? ""}|${props.initialTranslations?.de ?? ""}`
      : props.mode;
  return <TranslateDialogInner key={key} {...props} />;
}
