/**
 * One-time script: converts the existing plain-string `hero_description` and
 * `description` content_block rows into the "basic prose" Lexical
 * EditorState shape (ADR-0017), so the owner's current text survives as-is
 * once the admin editor and public render switch to rich text.
 *
 * Each present locale's string becomes a single-paragraph EditorState (built
 * via a headless Lexical editor, so the JSON is exactly what the real editor
 * would produce — no hand-rolled node shape to keep in sync). `value_source`
 * is left untouched; only `value` changes shape.
 *
 * Idempotent: rows already in the new shape (`type: "localizedEditorState"`)
 * are skipped, so re-running after a partial run just picks up what's left.
 *
 * Wired into `db:migrate` (which `pnpm build`/`pnpm start` already run), same
 * as `backfill-gallery-dimensions` — safe to leave there permanently since
 * every run after the first is a no-op (both rows are already the new shape).
 * Only issues SELECT/UPDATE (no DDL), so the pooled `DATABASE_URL` is fine.
 *
 * Run directly with: pnpm migrate-content-blocks-to-rich-text
 */
import type { SerializedEditorState } from "lexical";
import type { LocalizedEditorStateValue } from "@/db/schema.js";

try {
  process.loadEnvFile(".env.local");
} catch {}

const { getDb } = await import("@/db/index.js");
const { contentBlock } = await import("@/db/schema.js");
const { inArray, eq } = await import("drizzle-orm");
const { createHeadlessEditor } = await import("@lexical/headless");
const { $getRoot, $createParagraphNode, $createTextNode } =
  await import("lexical");

const KEYS = ["description", "hero_description"];
const LOCALES = ["nl", "en", "fr", "de"] as const;
type TargetLocale = (typeof LOCALES)[number];

function wrapTextAsEditorState(text: string): SerializedEditorState {
  const editor = createHeadlessEditor({
    namespace: "migrate-content-blocks",
    onError: (error) => {
      throw error;
    },
  });
  editor.update(
    () => {
      const root = $getRoot();
      root.clear();
      const paragraph = $createParagraphNode();
      paragraph.append($createTextNode(text));
      root.append(paragraph);
    },
    { discrete: true },
  );
  return editor.getEditorState().toJSON();
}

const db = getDb();
const rows = await db
  .select()
  .from(contentBlock)
  .where(inArray(contentBlock.key, KEYS));

let migrated = 0;

for (const row of rows) {
  if (row.value?.type !== "localizedText") {
    console.log(`Skipping "${row.key}": not a plain-text row.`);
    continue;
  }

  const wrapped: Partial<Record<TargetLocale, SerializedEditorState>> = {};
  for (const locale of LOCALES) {
    const text = row.value[locale];
    if (typeof text === "string" && text.trim() !== "") {
      wrapped[locale] = wrapTextAsEditorState(text);
    }
  }

  if (!wrapped.nl) {
    console.warn(`Skipping "${row.key}": no Dutch text to migrate.`);
    continue;
  }

  const value: LocalizedEditorStateValue = {
    type: "localizedEditorState",
    ...wrapped,
    nl: wrapped.nl,
  };

  await db
    .update(contentBlock)
    .set({ value })
    .where(eq(contentBlock.key, row.key));

  migrated++;
  console.log(
    `Migrated "${row.key}" (${Object.keys(value)
      .filter((k) => k !== "type")
      .join(", ")}).`,
  );
}

console.log(`Done: ${migrated} of ${rows.length} row(s) migrated.`);
