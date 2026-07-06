"use server";

import {
  createServerValidate,
  ServerValidateError,
  initialFormState,
} from "@tanstack/react-form-nextjs";
import { revalidatePath, updateTag } from "next/cache";
import { getDb } from "@/db";
import { page } from "@/db/schema";
import type { LocalizedEditorState } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifySession } from "@/lib/auth/session";
import { slugify } from "@/lib/content/slug";
import { saveAuthoredContent } from "@/lib/content/authored-save";
import { parseDetailField } from "@/lib/content/lexical/parse-detail-field";
import { uniquePageSlugFrom } from "@/lib/pages/unique-slug";
import {
  assertPageDeletable,
  assertPagePublishToggleable,
} from "@/lib/pages/system-guards";
import { CACHE_TAGS } from "@/lib/cache-tags";
import {
  pageFormOpts,
  pageFormServerSchema,
  localizedStringSchema,
} from "./shared";

export type PageActionState = {
  success: boolean;
  errorMap: { onServer?: unknown };
  values: unknown;
  errors: unknown[];
  failures?: string[];
};

const serverValidate = createServerValidate({
  ...pageFormOpts,
  onServerValidate: ({ value }) => {
    const result = pageFormServerSchema.safeParse(value);
    if (!result.success) {
      return result.error.issues[0]?.message ?? "Validatie mislukt";
    }
  },
});

function parseLocalizedField(formData: FormData, key: string) {
  const raw = formData.get(key);
  const parsed =
    typeof raw === "string"
      ? (() => {
          try {
            return JSON.parse(raw);
          } catch {
            return raw;
          }
        })()
      : raw;
  return localizedStringSchema.parse(parsed);
}

// A page body is required (unlike POI `detail`): parseDetailField's null
// (absent/malformed/empty) becomes a validation error in the actions below.
function parseBodyField(formData: FormData): LocalizedEditorState | null {
  return parseDetailField(formData, "body");
}

function invalidate() {
  revalidatePath("/admin/pages");
  updateTag(CACHE_TAGS.pages);
}

// The `page` table is tiny, so fetching every slug once is cheaper than a
// LIKE query (mirrors `uniquePoiSlug`); the dedup/reserved-skip logic itself
// is the pure, unit-tested `uniquePageSlugFrom`.
async function uniquePageSlug(
  db: ReturnType<typeof getDb>,
  base: string,
): Promise<string> {
  const rows = await db.select({ slug: page.slug }).from(page);
  return uniquePageSlugFrom(base, new Set(rows.map((r) => r.slug)));
}

export async function createPageAction(
  _prev: unknown,
  formData: FormData,
): Promise<PageActionState> {
  await verifySession();
  try {
    await serverValidate(formData);

    const title = parseLocalizedField(formData, "title");
    const body = parseBodyField(formData);
    if (!body) {
      return {
        ...initialFormState,
        success: false,
        errorMap: { onServer: "Hoofdtekst is vereist" },
      };
    }

    const db = getDb();

    const { failures } = await saveAuthoredContent({
      tag: CACHE_TAGS.pages,
      revalidatePaths: ["/admin/pages"],
      fields: () => ({
        title: { kind: "text", source: title.nl.trim(), stored: undefined },
        body: { kind: "detail", source: body.nl, stored: undefined },
      }),
      persist: async (resolved) => {
        // Unreachable in practice: `body` was already confirmed non-null
        // above, and a non-null `source` always resolves to a non-null
        // outcome (see resolveAuthoredFields). Guards the type only.
        if (!resolved.body) throw new Error("Hoofdtekst is vereist");

        // Slug is derived from the English title produced by the resolver
        // (which just ran above), then deduped. Generated once here and
        // never changed on edit. See ADR-0015/ADR-0020.
        const englishTitle = resolved.title.value.en ?? title.nl;
        const slug = await uniquePageSlug(db, slugify(englishTitle));

        await db.insert(page).values({
          id: crypto.randomUUID(),
          slug,
          title: resolved.title.value,
          titleSource: resolved.title.source,
          body: resolved.body.value,
          bodySource: resolved.body.source,
          // Owner-created pages are draft by default (ADR-0020) — unlike
          // live-on-create POIs, pages claim top-level, sitemap-visible URLs.
          published: false,
          system: false,
        });
      },
    });

    return {
      ...initialFormState,
      success: true,
      failures: failures.length ? failures : undefined,
    };
  } catch (e) {
    if (e instanceof ServerValidateError) {
      return { ...e.formState, success: false };
    }
    throw e;
  }
}

export async function updatePageAction(
  id: string,
  _prev: unknown,
  formData: FormData,
): Promise<PageActionState> {
  await verifySession();
  try {
    await serverValidate(formData);
    const db = getDb();

    // Load the existing row upfront; reused (not re-fetched) as the
    // pipeline's stored row for the dirty-check the translation resolvers
    // perform.
    const [existingPage] = await db.select().from(page).where(eq(page.id, id));

    const title = parseLocalizedField(formData, "title");
    const body = parseBodyField(formData);
    if (!body) {
      return {
        ...initialFormState,
        success: false,
        errorMap: { onServer: "Hoofdtekst is vereist" },
      };
    }

    const { failures } = await saveAuthoredContent({
      tag: CACHE_TAGS.pages,
      revalidatePaths: ["/admin/pages"],
      load: async () => existingPage,
      fields: (stored) => ({
        title: {
          kind: "text",
          source: title.nl.trim(),
          stored: stored?.title,
        },
        body: { kind: "detail", source: body.nl, stored: stored?.body },
      }),
      persist: async (resolved) => {
        if (!resolved.body) throw new Error("Hoofdtekst is vereist");

        await db
          .update(page)
          .set({
            title: resolved.title.value,
            titleSource: resolved.title.source,
            body: resolved.body.value,
            bodySource: resolved.body.source,
          })
          .where(eq(page.id, id));
      },
    });

    return {
      ...initialFormState,
      success: true,
      failures: failures.length ? failures : undefined,
    };
  } catch (e) {
    if (e instanceof ServerValidateError) {
      return { ...e.formState, success: false };
    }
    throw e;
  }
}

export async function togglePagePublishedAction(
  id: string,
  published: boolean,
) {
  await verifySession();
  const db = getDb();
  const [row] = await db
    .select({ system: page.system })
    .from(page)
    .where(eq(page.id, id));
  if (!row) return;
  assertPagePublishToggleable(row);

  await db.update(page).set({ published }).where(eq(page.id, id));
  invalidate();
}

export async function deletePageAction(id: string) {
  await verifySession();
  const db = getDb();
  const [row] = await db
    .select({ system: page.system })
    .from(page)
    .where(eq(page.id, id));
  if (!row) return;
  assertPageDeletable(row);

  await db.delete(page).where(eq(page.id, id));
  invalidate();
}
