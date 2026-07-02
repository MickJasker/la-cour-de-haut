"use server";

import {
  createServerValidate,
  ServerValidateError,
  initialFormState,
} from "@tanstack/react-form-nextjs";
import { revalidatePath, updateTag } from "next/cache";
import {
  deleteBlobAndRecord,
  deleteBlobBestEffort,
} from "@/lib/media/blob-delete";
import { getDb } from "@/db";
import { poi } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifySession } from "@/lib/dal";
import { slugify } from "@/lib/content/slug";
import { saveAuthoredContent } from "@/lib/content/authored-save";
import { parseDetailField } from "@/lib/content/lexical/parse-detail-field";
import { CACHE_TAGS } from "@/lib/cache-tags";
import {
  poiFormOpts,
  poiFormServerSchema,
  localizedStringSchema,
} from "./shared";

export type PoiActionState = {
  success: boolean;
  errorMap: { onServer?: unknown };
  values: unknown;
  errors: unknown[];
  failures?: string[];
};

const serverValidate = createServerValidate({
  ...poiFormOpts,
  onServerValidate: ({ value }) => {
    const result = poiFormServerSchema.safeParse(value);
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

function parseDistanceKm(raw: string | undefined): number | null {
  if (!raw || raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function parseSortOrder(raw: FormDataEntryValue | null): number {
  if (raw === null || raw === "") return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function invalidate() {
  revalidatePath("/admin/pois");
  updateTag(CACHE_TAGS.poi);
}

/**
 * Finds a unique slug from a base, appending `-2`, `-3`, … on collision. The
 * `poi` table is tiny, so fetching every slug once is cheaper than a LIKE query.
 * Falls back to "poi" when the base is empty (title had no slug-worthy chars).
 */
async function uniquePoiSlug(
  db: ReturnType<typeof getDb>,
  base: string,
): Promise<string> {
  const root = base || "poi";
  const rows = await db.select({ slug: poi.slug }).from(poi);
  const taken = new Set(rows.map((r) => r.slug));
  if (!taken.has(root)) return root;
  let n = 2;
  while (taken.has(`${root}-${n}`)) n++;
  return `${root}-${n}`;
}

export async function createPoiAction(
  _prev: unknown,
  formData: FormData,
): Promise<PoiActionState> {
  await verifySession();
  try {
    const data = await serverValidate(formData);

    const imageUrl = formData.get("imageUrl");
    if (typeof imageUrl !== "string" || imageUrl.trim() === "") {
      return {
        ...initialFormState,
        success: false,
        errorMap: { onServer: "Afbeelding is vereist" },
      };
    }

    const title = parseLocalizedField(formData, "title");
    const body = parseLocalizedField(formData, "body");
    const detail = parseDetailField(formData);
    const db = getDb();

    const { failures } = await saveAuthoredContent({
      tag: CACHE_TAGS.poi,
      revalidatePaths: ["/admin/pois"],
      fields: () => ({
        title: { kind: "text", source: title.nl.trim(), stored: undefined },
        body: { kind: "text", source: body.nl.trim(), stored: undefined },
        detail: {
          kind: "detail",
          source: detail?.nl ?? null,
          stored: undefined,
        },
      }),
      persist: async (resolved) => {
        // Slug is derived from the English title produced by the resolver
        // (which just ran above), then deduped. Generated once here and
        // never changed on edit. See ADR-0015.
        const englishTitle = resolved.title.value.en ?? title.nl;
        const slug = await uniquePoiSlug(db, slugify(englishTitle));

        await db.insert(poi).values({
          id: crypto.randomUUID(),
          slug,
          title: resolved.title.value,
          titleSource: resolved.title.source,
          body: resolved.body.value,
          bodySource: resolved.body.source,
          detail: resolved.detail?.value ?? null,
          detailSource: resolved.detail?.source ?? null,
          imageUrl,
          distanceKm: parseDistanceKm(data.distanceKm),
          sortOrder: parseSortOrder(formData.get("sortOrder")),
          published: data.published,
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

export async function updatePoiAction(
  id: string,
  _prev: unknown,
  formData: FormData,
): Promise<PoiActionState> {
  await verifySession();
  try {
    const data = await serverValidate(formData);
    const db = getDb();

    // Load the existing row upfront for the image-swap check; the same row
    // is reused (not re-fetched) as the pipeline's stored row for the
    // dirty-check / gap-fill the translation resolvers perform.
    const [existingPoi] = await db.select().from(poi).where(eq(poi.id, id));

    let imageUrl: string | undefined;
    const newImageUrl = formData.get("imageUrl");
    if (typeof newImageUrl === "string" && newImageUrl.trim() !== "") {
      // Best-effort: a failed delete of the OLD image must not block saving
      // the new one (see deleteBlobBestEffort's doc comment).
      if (existingPoi?.imageUrl) {
        await deleteBlobBestEffort(existingPoi.imageUrl);
      }
      imageUrl = newImageUrl;
    }

    const title = parseLocalizedField(formData, "title");
    const body = parseLocalizedField(formData, "body");
    const detail = parseDetailField(formData);

    const { failures } = await saveAuthoredContent({
      tag: CACHE_TAGS.poi,
      revalidatePaths: ["/admin/pois"],
      load: async () => existingPoi,
      fields: (stored) => ({
        title: {
          kind: "text",
          source: title.nl.trim(),
          stored: stored?.title,
        },
        body: { kind: "text", source: body.nl.trim(), stored: stored?.body },
        detail: {
          kind: "detail",
          source: detail?.nl ?? null,
          stored: stored?.detail ?? undefined,
        },
      }),
      persist: async (resolved) => {
        await db
          .update(poi)
          .set({
            title: resolved.title.value,
            titleSource: resolved.title.source,
            body: resolved.body.value,
            bodySource: resolved.body.source,
            detail: resolved.detail?.value ?? null,
            detailSource: resolved.detail?.source ?? null,
            distanceKm: parseDistanceKm(data.distanceKm),
            sortOrder: parseSortOrder(formData.get("sortOrder")),
            published: data.published,
            ...(imageUrl ? { imageUrl } : {}),
          })
          .where(eq(poi.id, id));
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

export async function togglePoiPublishedAction(id: string, published: boolean) {
  await verifySession();
  const db = getDb();
  await db.update(poi).set({ published }).where(eq(poi.id, id));
  invalidate();
}

export async function deletePoiAction(id: string) {
  await verifySession();
  const db = getDb();
  const [row] = await db
    .select({ imageUrl: poi.imageUrl })
    .from(poi)
    .where(eq(poi.id, id));

  if (!row) return;

  await deleteBlobAndRecord(
    row.imageUrl,
    async () => {
      await db.delete(poi).where(eq(poi.id, id));
    },
    { entityLabel: "POI image", id },
  );

  invalidate();
}

export async function reorderPoisAction(ids: string[]) {
  await verifySession();
  const db = getDb();
  await Promise.all(
    ids.map((id, index) =>
      db
        .update(poi)
        .set({ sortOrder: index * 10 })
        .where(eq(poi.id, id)),
    ),
  );
  invalidate();
}
