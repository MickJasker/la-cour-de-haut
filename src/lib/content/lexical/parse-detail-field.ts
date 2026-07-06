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
 * Parses a JSON-encoded rich-text FormData field submitted by every
 * rich-text admin form — POI detail (ADR-0015), hero/gîte prose (ADR-0017),
 * and page body (ADR-0020, field name "body"). The wire format is always the
 * localized `{ nl, en?, fr?, de? }` shape (matching
 * `LocalizedEditorState`/storage), never a bare EditorState, so every save
 * path shares one parser and one empty-content rule.
 *
 * Returns null when the field is absent, malformed, fails schema validation,
 * or has no real text content in `nl` (the editor always serializes at least
 * one empty paragraph) — so empty content is uniformly treated as "no
 * content"; callers decide whether that means NULL (POI) or a validation
 * error (page body, which is required).
 */
export function parseDetailField(
  formData: FormData,
  field = "detail",
): LocalizedEditorState | null {
  const raw = formData.get(field);
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
