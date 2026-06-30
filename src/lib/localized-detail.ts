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
 * Auto-translate resolver for the POI rich-text `detail` field (ADR-0016).
 *
 * Wires the pure `resolveAuthoredField` seam for `SerializedEditorState`,
 * routing translation through the Lexical HTML bridge so that inline
 * formatting (bold, links, headings) survives Google's `text/html` pass.
 *
 * isEmpty: a state with no real text content is treated as absent.
 * equals:  JSON-stringify comparison (the same content always serialises
 *          identically when produced by the same Lexical editor version).
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
    equals: (a, b) => JSON.stringify(a) === JSON.stringify(b),
    translate: async (state, target) => {
      const html = await editorStateToHtml(state);
      const translatedHtml = await translateText(html, target, {
        mimeType: "text/html",
      });
      return htmlToEditorState(translatedHtml);
    },
  });
}
