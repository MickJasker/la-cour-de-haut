# ADR-0014: Reviews carry their own original language

**Status:** Accepted

Refines [ADR-0003](./0003-jsonb-i18n-columns.md) (jsonb i18n columns) and revises decision #5 of [ADR-0010](./0010-reviews-feature-design.md) (the `body[locale] ?? body.nl` fallback).

## Context

The translate content model (see `CONTEXT.md`) assumes **owner-authored** content: the owner writes Dutch, then auto-translates outward to EN/FR/DE. The original language is always `nl`, so `review.body` made `nl` the one required key, `inferBodySource` hardcoded `nl: "human"`, and `translateToAllLocales` translated `nl → {en, fr, de}` and could never produce `nl`.

Reviews break that assumption. A review is **quoted content**: the canonical text is a guest's verbatim words, in whatever language the guest chose — usually EN, sometimes FR/DE, occasionally a language outside the four display locales (e.g. Italian). The old model forced the owner to either paste English into the Dutch slot (then mistranslate it as if it were Dutch) or hand-translate the review into Dutch first and let the machine round-trip it back — degrading the language the guest actually wrote in.

The fix is scoped to reviews only; POIs and content blocks remain owner-authored Dutch-first.

## Decision

A review records the language it was written in, and preserves the verbatim original as the source of truth.

- **New columns** `original_locale` and `original_body`, both `NOT NULL`. `original_body` is the verbatim guest quote in `original_locale`; this pair is the source of truth on **every** review.
- **`body` becomes a projection.** Its four locale keys all become optional (`{ nl?; en?; fr?; de? }`). The `NOT NULL` presence guarantee moves off `body.nl` and onto `original_body`/`original_locale`.
- **Translation goes outward from the original.** Auto-translate fills the display locales from `original_body`. When `original_locale` is one of the four, that slot is seeded from `original_body` and marked `human`, and only the other three are machine-translated. When it is outside the four, all four display locales are `machine` and the review has no `human` display slot — `bodySource` is no longer hardcoded.
- **Any original language is supported, original preserved.** The admin form offers the four named locales plus "Andere taal (auto-detect)". For "Andere", Google detects the language at translate time and we overwrite `original_locale` with the detected code; a detected _known_ locale collapses into the same rule as picking that locale by hand. Until detection runs, `original_locale` holds the BCP-47 sentinel `"und"`.
- **Lenient publish + explicit fallback chain.** Consistent with ADR-0010's leniency, a review may be published before translation. Because `body.nl` is no longer guaranteed, the public fallback chain becomes `body[locale] ?? body.nl ?? body.en ?? body.fr ?? body.de ?? original_body` — prefer any readable display translation before resorting to the possibly-foreign verbatim original.
- **Public "translated" marker.** A review card shows "Vertaald uit het &lt;taal&gt;" (language name via `Intl.DisplayNames`, localized into the visitor's locale) **only** when the visitor reads a `machine` slot in their own locale; `und` originals fall back to generic wording. Reading a `human` slot, or a cross-locale fallback, shows no marker.
- **Migration.** Add the columns nullable, backfill `original_locale = 'nl'` and `original_body = body->>'nl'`, then set `NOT NULL`. Existing reviews were all Dutch-original, so this reproduces their reality exactly.

## Consequences

- The "the `body` slot marked `human` _is_ the original" invariant now holds only when the original is one of the four display locales; foreign-original reviews have no `human` display slot, which is expected.
- `original_body` and `body[original_locale]` (when the original is one of the four) start out identical but may legitimately diverge: `original_body` is the immutable guest quote, while the display slot can be lightly cleaned up by the owner.
- ADR-0010 decision #5 is superseded by the longer fallback chain above.
- A dedicated `translateReviewBody(text, sourceLocale)` is added rather than changing `translateToAllLocales`'s signature. It accepts an arbitrary (or auto-detected, via the `"und"` sentinel) source language and returns the detected source plus a partial map over the four display locales. `translateToAllLocales` is left untouched because it still serves authored content with three healthy callers (gallery, POIs, content blocks) that depend on its fixed `{ en, fr, de }` shape; the two functions share a `getTranslationClient()` helper.
- Translation is server-authoritative and a post-save operation: `translateReviewAction` recomputes `body`/`bodySource` through the shared `buildReviewBody` from the saved verbatim original and overwrites `original_locale` with the detected code. The single writer of `body`/`bodySource` on both the create and translate paths is `buildReviewBody`, which is why the original "Dutch is always the source" bug (hardcoded in two places) cannot recur.
