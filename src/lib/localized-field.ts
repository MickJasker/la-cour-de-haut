import { translateText } from "@/lib/translate";

export const TARGET_LOCALES = ["en", "fr", "de"] as const;
export type TargetLocale = (typeof TARGET_LOCALES)[number];
export type Localized<T = string> = { nl: T } & Partial<
  Record<TargetLocale, T>
>;
export type LocalizedSource = {
  nl: "human" | "machine";
  en?: "human" | "machine";
  fr?: "human" | "machine";
  de?: "human" | "machine";
};

/**
 * Pure seam for auto-translate on save (ADR-0016). Decides which target locales
 * need translation, runs them in parallel via `Promise.allSettled` (so one
 * failure does not lose the others), and returns the merged value + provenance
 * map + failure list.
 *
 * The translator is injected so `resolveAuthoredField` is unit-testable with a
 * stub and has no direct dependency on `translate.ts`.
 */
export async function resolveAuthoredField<T>(input: {
  /** Incoming nl source from the save action (what the owner just typed). */
  source: T;
  /** Existing DB value; undefined on create. */
  stored?: Localized<T>;
  /** Returns true when a value should be treated as absent/empty. */
  isEmpty: (v: T | undefined) => boolean;
  /** Returns true when the two source values are semantically equal (no re-translate needed). */
  equals: (a: T, b: T) => boolean;
  /** Injected per-locale translator. Throw to signal failure for that locale. */
  translate: (source: T, target: TargetLocale) => Promise<T>;
}): Promise<{
  value: Localized<T>;
  source: LocalizedSource;
  failures: TargetLocale[];
}> {
  const { source, stored, isEmpty, equals, translate } = input;

  // Empty source: never translate, return bare nl-only value.
  if (isEmpty(source)) {
    return {
      value: { nl: source },
      source: { nl: "human" },
      failures: [],
    };
  }

  const failures: TargetLocale[] = [];
  const value: Localized<T> = { nl: source };
  const sourceMap: LocalizedSource = { nl: "human" };

  // Determine whether the nl source changed since the last save.
  const sourceChanged = !stored || !equals(source, stored.nl);

  let targetsToTranslate: TargetLocale[];

  if (sourceChanged) {
    // Create or source-changed: (re-)translate every target locale.
    targetsToTranslate = [...TARGET_LOCALES];
  } else {
    // Source unchanged: only gap-fill locales that are missing or empty.
    targetsToTranslate = TARGET_LOCALES.filter((t) => isEmpty(stored![t]));

    // Copy existing present targets straight through. Stamped "machine"
    // unconditionally — under ADR-0016 every target locale IS machine, full
    // stop (human-edit protection was removed), and this seam is handed only
    // the stored VALUE (`Localized<T>`), never a stored source map, so it has
    // no provenance to preserve even for a pre-ADR-0016 legacy "human" value
    // passing through unchanged. This is intentional, not a lost distinction.
    for (const t of TARGET_LOCALES) {
      if (!targetsToTranslate.includes(t)) {
        const storedVal = stored![t];
        if (storedVal !== undefined) {
          value[t] = storedVal;
          sourceMap[t] = "machine";
        }
      }
    }
  }

  if (targetsToTranslate.length > 0) {
    // allSettled so a single-locale failure does not lose the successful ones.
    const results = await Promise.allSettled(
      targetsToTranslate.map((target) => translate(source, target)),
    );

    for (let i = 0; i < targetsToTranslate.length; i++) {
      const target = targetsToTranslate[i];
      const result = results[i];

      if (result.status === "fulfilled") {
        value[target] = result.value;
        sourceMap[target] = "machine";
      } else {
        failures.push(target);
        // Degrade gracefully: keep the stored value if one exists so we never
        // serve a blank locale when we had something before.
        const storedVal = stored?.[target];
        if (storedVal !== undefined) {
          value[target] = storedVal;
          sourceMap[target] = "machine";
        }
        // If there is no stored value, the locale is simply absent — the public
        // fallback chain (`field[locale] ?? field.nl`) will serve Dutch.
      }
    }
  }

  return { value, source: sourceMap, failures };
}

/**
 * Convenience wrapper for plain Dutch→EN/FR/DE text translation (ADR-0016).
 * Wires the standard isEmpty/equals/translateText triple into `resolveAuthoredField`
 * so call-sites don't repeat the boilerplate.
 */
export function resolveLocalizedText(
  source: string,
  stored?: Localized<string>,
): Promise<{
  value: Localized<string>;
  source: LocalizedSource;
  failures: TargetLocale[];
}> {
  return resolveAuthoredField<string>({
    source,
    stored,
    isEmpty: (v) => !v || v.trim() === "",
    equals: (a, b) => a === b,
    translate: (s, t) => translateText(s, t),
  });
}
