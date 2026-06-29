"use server";

import type { SerializedEditorState } from "lexical";
import { verifySession } from "@/lib/dal";
import { editorStateToHtml, htmlToEditorState } from "@/lib/lexical/bridge";
import { translateHtmlToAllLocales } from "@/lib/translate";

export type PoiDetailTranslations = {
  en: SerializedEditorState;
  fr: SerializedEditorState;
  de: SerializedEditorState;
};

/**
 * Translates the Dutch POI detail EditorState into en/fr/de through the HTML
 * bridge (EditorState -> HTML -> Google text/html -> HTML -> EditorState).
 * Returns the translated states WITHOUT persisting: the translate dialog hands
 * them to the form (both create and edit), and the form's Save is the single
 * writer via create/updatePoiAction. See ADR-0015.
 */
export async function translatePoiDetailAction(
  detailNl: SerializedEditorState,
): Promise<PoiDetailTranslations> {
  await verifySession();

  const html = await editorStateToHtml(detailNl);
  const { en, fr, de } = await translateHtmlToAllLocales(html);

  const [enState, frState, deState] = await Promise.all([
    htmlToEditorState(en),
    htmlToEditorState(fr),
    htmlToEditorState(de),
  ]);

  return { en: enState, fr: frState, de: deState };
}
