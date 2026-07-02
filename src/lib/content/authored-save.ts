import type { SerializedEditorState } from "lexical";
import { revalidatePath, updateTag } from "next/cache";
import {
  resolveLocalizedText,
  type Localized,
  type LocalizedSource,
  type TargetLocale,
} from "@/lib/translation/localized-field";
import { resolveLocalizedDetail } from "@/lib/translation/localized-detail";
import type { CacheTag } from "@/lib/cache-tags";

/**
 * The full save-side ritual for **authored content** (POIs, content blocks,
 * gallery alt text — CONTEXT.md's "translate content model"; reviews stay
 * outside, see ADR-0014): load the stored row → diff each field's Dutch
 * source against what's stored → resolve via `resolveAuthoredField` (one
 * `Promise.allSettled` fan-out per field, run in parallel across fields) →
 * hand the resolved locales + provenance to the caller to persist → collect
 * per-locale failures across every field → invalidate the cache tag.
 *
 * Per-content-type differences are thin configuration: which fields exist,
 * whether a field is plain text or rich `detail` (POI/`content_block` rich
 * text), how the stored row is loaded, how the resolved fields are written,
 * and which cache tag to invalidate. What's NOT configurable — the load →
 * diff → resolve → invalidate sequence itself, and the failure union — is
 * exactly the ritual that used to be hand-rolled three times.
 */

export type AuthoredTextFieldInput = {
  kind: "text";
  /** The nl source the owner just submitted. */
  source: string;
  /** Existing stored value for this field; undefined on create / no row. */
  stored: Localized<string> | undefined;
};

export type AuthoredDetailFieldInput = {
  kind: "detail";
  /** The nl source EditorState the owner just submitted, or null when the
   *  field was left empty — an absent detail field is never translated. */
  source: SerializedEditorState | null;
  stored: Localized<SerializedEditorState> | undefined;
};

export type AuthoredFieldInput =
  | AuthoredTextFieldInput
  | AuthoredDetailFieldInput;

type ResolvedOutcome<T> = {
  value: Localized<T>;
  source: LocalizedSource;
  failures: TargetLocale[];
};

/**
 * The resolved shape for one field: text fields always resolve (`source` is
 * always a string, possibly empty); a `detail` field resolves to `null` when
 * its `source` was `null` (nothing to translate, nothing stored).
 */
export type AuthoredFieldResult<F extends AuthoredFieldInput> =
  F extends AuthoredTextFieldInput
    ? ResolvedOutcome<string>
    : ResolvedOutcome<SerializedEditorState> | null;

export type ResolvedAuthoredFields<
  TFields extends Record<string, AuthoredFieldInput>,
> = {
  [K in keyof TFields]: AuthoredFieldResult<TFields[K]>;
};

async function resolveField<F extends AuthoredFieldInput>(
  field: F,
): Promise<AuthoredFieldResult<F>> {
  if (field.kind === "text") {
    // Trimming, if any, is the caller's responsibility (matched to what each
    // call site did before this pipeline existed — e.g. POI title/body trim,
    // gallery alt text does not) so behavior stays identical per field.
    const result = await resolveLocalizedText(field.source, field.stored);
    return result as AuthoredFieldResult<F>;
  }
  if (field.source === null) {
    return null as AuthoredFieldResult<F>;
  }
  const result = await resolveLocalizedDetail(field.source, field.stored);
  return result as AuthoredFieldResult<F>;
}

/**
 * Resolves every field of an authored entity in parallel and returns the
 * deduped union of per-locale failures across all of them — the "diff
 * sources → resolve → collect per-locale failures" slice of the pipeline,
 * exposed standalone so it's unit-testable through its own interface without
 * a database.
 */
export async function resolveAuthoredFields<
  TFields extends Record<string, AuthoredFieldInput>,
>(
  fields: TFields,
): Promise<{ resolved: ResolvedAuthoredFields<TFields>; failures: string[] }> {
  const keys = Object.keys(fields) as (keyof TFields & string)[];
  const outcomes = await Promise.all(
    keys.map((key) => resolveField(fields[key])),
  );

  const resolved = {} as ResolvedAuthoredFields<TFields>;
  const failureSet = new Set<string>();
  keys.forEach((key, i) => {
    const outcome = outcomes[i];
    resolved[key] = outcome as ResolvedAuthoredFields<TFields>[typeof key];
    outcome?.failures.forEach((failure) => failureSet.add(failure));
  });

  return { resolved, failures: Array.from(failureSet) };
}

/**
 * The single entry point for saving authored content (ADR-0016). Owns
 * load → diff → resolve → persist → invalidate end to end; the caller
 * supplies only content-specific configuration:
 *
 * - `load` fetches the stored row (omit for a create with nothing to diff
 *   against — every field then translates unconditionally).
 * - `fields` maps the stored row to the field inputs to resolve.
 * - `persist` writes the resolved locales + provenance (and any
 *   non-translatable columns the caller closes over, e.g. `distanceKm`).
 * - `tag` / `revalidatePaths` name what to invalidate after persisting.
 */
export async function saveAuthoredContent<
  TFields extends Record<string, AuthoredFieldInput>,
  TStored = undefined,
>(config: {
  tag: CacheTag;
  revalidatePaths?: string[];
  load?: () => Promise<TStored | undefined>;
  fields: (stored: TStored | undefined) => TFields;
  persist: (
    resolved: ResolvedAuthoredFields<TFields>,
    stored: TStored | undefined,
  ) => Promise<void>;
}): Promise<{ failures: string[] }> {
  const stored = config.load ? await config.load() : undefined;
  const fields = config.fields(stored);
  const { resolved, failures } = await resolveAuthoredFields(fields);

  await config.persist(resolved, stored);

  for (const path of config.revalidatePaths ?? []) {
    revalidatePath(path);
  }
  updateTag(config.tag);

  return { failures };
}
