"use server";
import {
  createServerValidate,
  ServerValidateError,
  initialFormState,
} from "@tanstack/react-form-nextjs";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { icalSource } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifySession } from "@/lib/dal";
import { sourceFormOpts, sourceFormServerSchema } from "./shared";

export type SourceActionState = {
  success: boolean;
  errorMap: { onServer?: unknown };
  values: unknown;
  errors: unknown[];
};

const serverValidate = createServerValidate({
  ...sourceFormOpts,
  onServerValidate: ({ value }) => {
    const result = sourceFormServerSchema.safeParse(value);
    if (!result.success) {
      return result.error.issues[0]?.message ?? "Validation failed";
    }
  },
});

export async function addSourceAction(
  _prev: unknown,
  formData: FormData,
): Promise<SourceActionState> {
  await verifySession();
  try {
    const data = await serverValidate(formData);
    const db = getDb();
    await db.insert(icalSource).values({
      id: crypto.randomUUID(),
      name: data.name,
      url: data.url,
      enabled: data.enabled,
    });
    revalidatePath("/admin/settings");
    return { ...initialFormState, success: true };
  } catch (e) {
    if (e instanceof ServerValidateError) {
      return { ...e.formState, success: false };
    }
    throw e;
  }
}

export async function updateSourceAction(
  id: string,
  _prev: unknown,
  formData: FormData,
): Promise<SourceActionState> {
  await verifySession();
  try {
    const data = await serverValidate(formData);
    const db = getDb();
    const [existing] = await db
      .select({ url: icalSource.url })
      .from(icalSource)
      .where(eq(icalSource.id, id));
    const urlChanged = existing?.url !== data.url;
    await db
      .update(icalSource)
      .set({
        name: data.name,
        url: data.url,
        enabled: data.enabled,
        // Only clear the cache when the URL changes to force an immediate re-fetch
        ...(urlChanged ? { cachedIntervals: null, lastSyncedAt: null } : {}),
      })
      .where(eq(icalSource.id, id));
    revalidatePath("/admin/settings");
    return { ...initialFormState, success: true };
  } catch (e) {
    if (e instanceof ServerValidateError) {
      return { ...e.formState, success: false };
    }
    throw e;
  }
}

export async function toggleSourceAction(id: string, enabled: boolean) {
  await verifySession();
  const db = getDb();
  await db.update(icalSource).set({ enabled }).where(eq(icalSource.id, id));
  revalidatePath("/admin/settings");
}

export async function deleteSourceAction(id: string) {
  await verifySession();
  const db = getDb();
  await db.delete(icalSource).where(eq(icalSource.id, id));
  revalidatePath("/admin/settings");
}
