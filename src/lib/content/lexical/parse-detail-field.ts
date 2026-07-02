import { z } from "zod";
import type { SerializedEditorState } from "lexical";
import type { LocalizedEditorState } from "@/db/schema";
import { hasEditorText } from "./empty-state";

// An EditorState is opaque machine-structured JSON; validate that it is an
// object with a `root` but pass it through verbatim (a strict object schema
// would strip the node tree's internal keys and corrupt the document).
const editorStateSchema = z.custom<SerializedEditorState>(
  (v) => typeof v === "object" && v !== null && "root" in v,
  { message: "Ongeldige editorinhoud" },
);

export const localizedEditorStateSchema = z.object({
  nl: editorStateSchema,
  en: editorStateSchema.optional(),
  fr: editorStateSchema.optional(),
  de: editorStateSchema.optional(),
});

/**
 * Parses the JSON-encoded "detail" FormData field submitted by every
 * rich-text admin form — POI detail (ADR-0015) and hero/gîte prose
 * (ADR-0017). The wire format is always the localized `{ nl, en?, fr?, de? }`
 * shape (matching `LocalizedEditorState`/storage), never a bare EditorState,
 * so both save paths share one parser and one empty-detail rule.
 *
 * Returns null when the field is absent, malformed, fails schema validation,
 * or has no real text content in `nl` (the editor always serializes at least
 * one empty paragraph) — so empty detail is uniformly treated as "no
 * content" and stored as NULL.
 */
export function parseDetailField(
  formData: FormData,
): LocalizedEditorState | null {
  const raw = formData.get("detail");
  if (typeof raw !== "string") return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const result = localizedEditorStateSchema.safeParse(parsed);
  if (!result.success) return null;
  const detail = result.data;
  return hasEditorText(detail.nl) ? detail : null;
}
