"use server";

import {
  createServerValidate,
  ServerValidateError,
  initialFormState,
} from "@tanstack/react-form-nextjs";
import { revalidatePath, updateTag } from "next/cache";
import { put, del } from "@vercel/blob";
import { getDb } from "@/db";
import {
  poi,
  type LocalizedEditorState,
  type LocalizedSource,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifySession } from "@/lib/dal";
import { slugify } from "@/lib/slug";
import { hasEditorText } from "@/lib/lexical/empty-state";
import { translateToAllLocales } from "@/lib/translate";
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

function buildLocalized(loc: ReturnType<typeof localizedStringSchema.parse>) {
  return {
    nl: loc.nl.trim(),
    ...(loc.en ? { en: loc.en.trim() } : {}),
    ...(loc.fr ? { fr: loc.fr.trim() } : {}),
    ...(loc.de ? { de: loc.de.trim() } : {}),
  };
}

function inferSource(loc: ReturnType<typeof localizedStringSchema.parse>) {
  return {
    nl: "human" as const,
    ...(loc.en ? { en: "machine" as const } : {}),
    ...(loc.fr ? { fr: "machine" as const } : {}),
    ...(loc.de ? { de: "machine" as const } : {}),
  };
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

/** Source map for a detail field: nl human, present translations machine. */
function buildDetailSource(detail: LocalizedEditorState): LocalizedSource {
  return {
    nl: "human",
    ...(detail.en ? { en: "machine" as const } : {}),
    ...(detail.fr ? { fr: "machine" as const } : {}),
    ...(detail.de ? { de: "machine" as const } : {}),
  };
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

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return {
        ...initialFormState,
        success: false,
        errorMap: { onServer: "Afbeelding is vereist" },
      };
    }

    const blob = await put(`pois/${crypto.randomUUID()}-${file.name}`, file, {
      access: "public",
    });

    const title = parseLocalizedField(formData, "title");
    const body = parseLocalizedField(formData, "body");
    const db = getDb();

    // Slug is derived from the English title (reusing the owner's translation
    // when present, else translating just for this), then deduped. Generated
    // once here and never changed on edit. See ADR-0015.
    const englishTitle = title.en ?? (await translateToAllLocales(title.nl)).en;
    const slug = await uniquePoiSlug(db, slugify(englishTitle));

    const detail = parseDetailField(formData);

    await db.insert(poi).values({
      id: crypto.randomUUID(),
      slug,
      title: buildLocalized(title),
      body: buildLocalized(body),
      detail,
      detailSource: detail ? buildDetailSource(detail) : null,
      titleSource: inferSource(title),
      bodySource: inferSource(body),
      imageUrl: blob.url,
      distanceKm: parseDistanceKm(data.distanceKm),
      sortOrder: parseSortOrder(formData.get("sortOrder")),
      published: data.published,
    });

    invalidate();
    return { ...initialFormState, success: true };
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

    let imageUrl: string | undefined;
    const file = formData.get("file");
    if (file instanceof File && file.size > 0) {
      const [existing] = await db
        .select({ imageUrl: poi.imageUrl })
        .from(poi)
        .where(eq(poi.id, id));
      if (existing?.imageUrl.includes("blob.vercel-storage.com")) {
        await del(existing.imageUrl);
      }
      const blob = await put(`pois/${crypto.randomUUID()}-${file.name}`, file, {
        access: "public",
      });
      imageUrl = blob.url;
    }

    const title = parseLocalizedField(formData, "title");
    const body = parseLocalizedField(formData, "body");
    const detail = parseDetailField(formData);
    await db
      .update(poi)
      .set({
        title: buildLocalized(title),
        body: buildLocalized(body),
        detail,
        detailSource: detail ? buildDetailSource(detail) : null,
        titleSource: inferSource(title),
        bodySource: inferSource(body),
        distanceKm: parseDistanceKm(data.distanceKm),
        sortOrder: parseSortOrder(formData.get("sortOrder")),
        published: data.published,
        ...(imageUrl ? { imageUrl } : {}),
      })
      .where(eq(poi.id, id));

    invalidate();
    return { ...initialFormState, success: true };
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
