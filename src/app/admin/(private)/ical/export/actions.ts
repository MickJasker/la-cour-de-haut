"use server";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { icalExportToken } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifySession } from "@/lib/auth/session";
import { z } from "zod";

const nameSchema = z
  .string()
  .min(1, "Name is required")
  .max(80, "Name must be 80 characters or fewer");

export async function createExportTokenAction(formData: FormData) {
  await verifySession();
  const result = nameSchema.safeParse(formData.get("name"));
  if (!result.success) {
    throw new Error(result.error.issues[0]?.message ?? "Validation failed");
  }
  const db = getDb();
  await db.insert(icalExportToken).values({
    id: crypto.randomUUID(),
    name: result.data,
    token:
      crypto.randomUUID().replace(/-/g, "") +
      crypto.randomUUID().replace(/-/g, ""),
  });
  revalidatePath("/admin/ical/export");
}

export async function deleteExportTokenAction(id: string) {
  await verifySession();
  const db = getDb();
  await db.delete(icalExportToken).where(eq(icalExportToken.id, id));
  revalidatePath("/admin/ical/export");
}
