"use server";

import {
  createServerValidate,
  ServerValidateError,
  initialFormState,
} from "@tanstack/react-form-nextjs";
import { revalidatePath, updateTag } from "next/cache";
import { del } from "@vercel/blob";
import { getDb } from "@/db";
import { poi, type LocalizedEditorState } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifySession } from "@/lib/dal";
import { slugify } from "@/lib/slug";
import { hasEditorText } from "@/lib/lexical/empty-state";
import { resolveLocalizedText } from "@/lib/localized-field";
import { resolveLocalizedDetail } from "@/lib/localized-detail";
import {
  poiFormOpts,
  poiFormServerSchema,
  localizedStringSchema,
  localizedEditorStateSchema,
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

/**
 * Parses the JSON-encoded detail field from FormData. Returns null when the
 * field is absent, malformed, or has no real text content (the editor always
 * serializes at least one empty paragraph), so empty detail is stored as NULL.
 */
function parseDetailField(formData: FormData): LocalizedEditorState | null {
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
  updateTag("poi");
}

/** Deduped union of the failure lists returned by the translation seam. */
function unionFailures(...lists: string[][]): string[] {
  return Array.from(new Set(lists.flat()));
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

    // Resolve all three fields in parallel (allSettled fan-out inside each resolver).
    const [titleRes, bodyRes] = await Promise.all([
      resolveLocalizedText(title.nl.trim(), undefined),
      resolveLocalizedText(body.nl.trim(), undefined),
    ]);
    const detailRes = detail?.nl
      ? await resolveLocalizedDetail(detail.nl, undefined)
      : null;

    // Slug is derived from the English title produced by the resolver (which
    // just ran above), then deduped. Generated once here and never changed on
    // edit. See ADR-0015.
    const englishTitle = titleRes.value.en ?? title.nl;
    const slug = await uniquePoiSlug(db, slugify(englishTitle));

    await db.insert(poi).values({
      id: crypto.randomUUID(),
      slug,
      title: titleRes.value,
      titleSource: titleRes.source,
      body: bodyRes.value,
      bodySource: bodyRes.source,
      detail: detailRes?.value ?? null,
      detailSource: detailRes?.source ?? null,
      imageUrl,
      distanceKm: parseDistanceKm(data.distanceKm),
      sortOrder: parseSortOrder(formData.get("sortOrder")),
      published: data.published,
    });

    invalidate();
    const failures = unionFailures(
      titleRes.failures,
      bodyRes.failures,
      detailRes?.failures ?? [],
    );
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

    // Load the existing row upfront for both the image-swap check and the
    // dirty-check / gap-fill that the translation resolvers perform.
    const [existingPoi] = await db.select().from(poi).where(eq(poi.id, id));

    let imageUrl: string | undefined;
    const newImageUrl = formData.get("imageUrl");
    if (typeof newImageUrl === "string" && newImageUrl.trim() !== "") {
      if (existingPoi?.imageUrl.includes("blob.vercel-storage.com")) {
        await del(existingPoi.imageUrl);
      }
      imageUrl = newImageUrl;
    }

    const title = parseLocalizedField(formData, "title");
    const body = parseLocalizedField(formData, "body");
    const detail = parseDetailField(formData);

    // Resolve translations: pass stored values so unchanged sources are
    // gap-filled only (not re-translated), and truly changed sources get a full
    // retranslate. Failures degrade — they never block the save.
    const [titleRes, bodyRes] = await Promise.all([
      resolveLocalizedText(title.nl.trim(), existingPoi?.title ?? undefined),
      resolveLocalizedText(body.nl.trim(), existingPoi?.body ?? undefined),
    ]);
    const detailRes = detail?.nl
      ? await resolveLocalizedDetail(
          detail.nl,
          existingPoi?.detail ?? undefined,
        )
      : null;

    await db
      .update(poi)
      .set({
        title: titleRes.value,
        titleSource: titleRes.source,
        body: bodyRes.value,
        bodySource: bodyRes.source,
        detail: detailRes?.value ?? null,
        detailSource: detailRes?.source ?? null,
        distanceKm: parseDistanceKm(data.distanceKm),
        sortOrder: parseSortOrder(formData.get("sortOrder")),
        published: data.published,
        ...(imageUrl ? { imageUrl } : {}),
      })
      .where(eq(poi.id, id));

    invalidate();
    const failures = unionFailures(
      titleRes.failures,
      bodyRes.failures,
      detailRes?.failures ?? [],
    );
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
  revalidatePath("/admin/pois");
  updateTag("poi");
}

export async function deletePoiAction(id: string) {
  await verifySession();
  const db = getDb();
  const [row] = await db
    .select({ imageUrl: poi.imageUrl })
    .from(poi)
    .where(eq(poi.id, id));

  if (!row) return;

  if (row.imageUrl.includes("blob.vercel-storage.com")) {
    await del(row.imageUrl);
  }
  await db.delete(poi).where(eq(poi.id, id));

  revalidatePath("/admin/pois");
  updateTag("poi");
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
  revalidatePath("/admin/pois");
  updateTag("poi");
}
