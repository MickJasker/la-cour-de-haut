import "server-only";
import type { SerializedEditorState } from "lexical";
import {
  resolveAuthoredField,
  type Localized,
  type LocalizedSource,
  type TargetLocale,
} from "@/lib/localized-field";
import { editorStateToHtml, htmlToEditorState } from "@/lib/lexical/bridge";
import { translateText } from "@/lib/translate";
import { hasEditorText } from "@/lib/lexical/empty-state";

/**
 * Structurally-equal clone of `value` with every plain object's keys sorted.
 * Array order is left untouched — in a Lexical `SerializedEditorState`, array
 * order encodes child/sibling order and is semantically significant, while
 * object key order is not.
 *
 * Needed because `stored` is read back from a Postgres `jsonb` column, which
 * canonicalizes (re-orders) object keys, while a freshly-serialized `source`
 * from the Lexical editor keeps the editor's own key order. Comparing via
 * plain `JSON.stringify` would treat identical content as "changed" whenever
 * the key order differs, defeating the dirty-check on every save.
 */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value !== null && typeof value === "object") {
    const sortedKeys = Object.keys(value as Record<string, unknown>).sort();
    const result: Record<string, unknown> = {};
    for (const key of sortedKeys) {
      result[key] = canonicalize((value as Record<string, unknown>)[key]);
    }
    return result;
  }
  return value;
}

/**
 * Auto-translate resolver for the POI rich-text `detail` field (ADR-0016).
 *
 * Wires the pure `resolveAuthoredField` seam for `SerializedEditorState`,
 * routing translation through the Lexical HTML bridge so that inline
 * formatting (bold, links, headings) survives Google's `text/html` pass.
 *
 * isEmpty: a state with no real text content is treated as absent.
 * equals:  key-order-independent deep comparison via `canonicalize` — `stored`
 *          comes back from jsonb with Postgres's canonical key order, while
 *          `source` is freshly-serialized Lexical output in the editor's own
 *          key order, so a plain `JSON.stringify` comparison would falsely
 *          flag unchanged content as changed (see `canonicalize` above).
 * translate: EditorState → HTML → Google text/html → HTML → EditorState.
 */
export function resolveLocalizedDetail(
  source: SerializedEditorState,
  stored?: Localized<SerializedEditorState>,
): Promise<{
  value: Localized<SerializedEditorState>;
  source: LocalizedSource;
  failures: TargetLocale[];
}> {
  return resolveAuthoredField<SerializedEditorState>({
    source,
    stored,
    isEmpty: (v) => !v || !hasEditorText(v),
    equals: (a, b) =>
      JSON.stringify(canonicalize(a)) === JSON.stringify(canonicalize(b)),
    translate: async (state, target) => {
      const html = await editorStateToHtml(state);
      const translatedHtml = await translateText(html, target, {
        mimeType: "text/html",
      });
      return htmlToEditorState(translatedHtml);
    },
  });
}
