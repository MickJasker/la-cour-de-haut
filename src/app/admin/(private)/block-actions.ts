"use server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { ownerBlock } from "@/db/schema";
import { verifySession } from "@/lib/auth/session";

/**
 * The house admin-mutation state shape: actions return validation failures so
 * the client (useActionState) can render them; auth and DB errors still throw
 * into the error boundary.
 */
export type BlockActionState = { success: boolean; error: string | null };

const dayString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const createSchema = z
  .object({
    start: dayString,
    // `end` is ALREADY exclusive — the client converts the inclusive selection
    // via inclusiveRangeToInterval before calling this action (ADR-0022).
    end: dayString,
    label: z.string().nullable(),
  })
  .refine((v) => v.start < v.end);

/** Empty (or whitespace-only) labels collapse to null — no private note stored. */
function normalizeLabel(label: string | null): string | null {
  const trimmed = label?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

export async function createOwnerBlockAction(input: {
  start: string;
  end: string;
  label: string | null;
}): Promise<BlockActionState> {
  await verifySession();
  const result = createSchema.safeParse(input);
  if (!result.success) {
    return { success: false, error: "Ongeldige selectie" };
  }
  // No conflict guard: a block only ever adds busyness, so overlap with active
  // bookings saves silently (ADR-0022 decision 2). The confirm guard and the
  // public calendar read the same busy intervals, so a pending request that
  // now overlaps simply can't be confirmed — the UI warns before saving.
  const db = getDb();
  await db.insert(ownerBlock).values({
    id: crypto.randomUUID(),
    startDate: result.data.start,
    endDate: result.data.end,
    label: normalizeLabel(result.data.label),
  });
  revalidatePath("/admin");
  return { success: true, error: null };
}

export async function updateOwnerBlockLabelAction(
  id: string,
  label: string,
): Promise<BlockActionState> {
  await verifySession();
  const db = getDb();
  await db
    .update(ownerBlock)
    .set({ label: normalizeLabel(label) })
    .where(eq(ownerBlock.id, id));
  revalidatePath("/admin");
  return { success: true, error: null };
}

export async function deleteOwnerBlockAction(
  id: string,
): Promise<BlockActionState> {
  await verifySession();
  const db = getDb();
  await db.delete(ownerBlock).where(eq(ownerBlock.id, id));
  revalidatePath("/admin");
  return { success: true, error: null };
}
