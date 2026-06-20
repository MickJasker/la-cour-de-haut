import "server-only";
import { z } from "zod";
import { getDb } from "@/db";
import { setting } from "@/db/schema";

const knownSettings = z
  .object({
    iban: z.string(),
    bank_name: z.string(),
    account_holder: z.string(),
    payment_deadline_days: z.coerce.number().int().positive(),
  })
  .partial();

export type Settings = z.infer<typeof knownSettings>;

export async function getSettings(): Promise<Settings> {
  const db = getDb();
  const rows = await db.select().from(setting);
  const raw = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return knownSettings.parse(raw);
}

export async function upsertSetting(key: string, value: string) {
  const db = getDb();
  await db
    .insert(setting)
    .values({ key, value })
    .onConflictDoUpdate({ target: setting.key, set: { value } });
}

export function hasBankDetails(s: Settings): boolean {
  return Boolean(s.iban && s.bank_name && s.account_holder);
}

export function paymentDeadlineDays(s: Settings): number {
  return s.payment_deadline_days ?? 7;
}
