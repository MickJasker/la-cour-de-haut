"use server";

import { eq } from "drizzle-orm";
import { revalidatePath, updateTag } from "next/cache";
import type { SerializedEditorState } from "lexical";
import { getDb } from "@/db";
import { poi } from "@/db/schema";
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
 * Returns the translated states WITHOUT persisting: create mode stuffs them
 * into form state and saves on submit; edit mode follows up immediately with
 * `persistPoiDetailTranslationAction`. See ADR-0015.
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

/**
 * Persists machine translations of the detail field immediately (edit mode).
 * Keeps the Dutch source slot intact; `detail_source` is deterministic under
 * the machine-only policy (nl human, the rest machine).
 */
export async function persistPoiDetailTranslationAction(
  id: string,
  translations: PoiDetailTranslations,
): Promise<void> {
  await verifySession();
  const db = getDb();

  const [row] = await db
    .select({ detail: poi.detail })
    .from(poi)
    .where(eq(poi.id, id));
  if (!row?.detail) return;

  await db
    .update(poi)
    .set({
      detail: {
        nl: row.detail.nl,
        en: translations.en,
        fr: translations.fr,
        de: translations.de,
      },
      detailSource: {
        nl: "human",
        en: "machine",
        fr: "machine",
        de: "machine",
      },
    })
    .where(eq(poi.id, id));

  revalidatePath("/admin/pois");
  updateTag("poi");
}
