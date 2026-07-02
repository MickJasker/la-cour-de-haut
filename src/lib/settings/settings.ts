import "server-only";
import { z } from "zod";
import { getDb } from "@/db";
import { setting } from "@/db/schema";
import { cacheLife, cacheTag, updateTag } from "next/cache";
import { settingsRegistry, type ServerShape } from "./registry";

// Cast is safe: Object.fromEntries loses per-key types but ServerShape
// captures them. The runtime shape is identical to the static assertion.
const knownSettings = z
  .object(
    Object.fromEntries(
      Object.entries(settingsRegistry).map(([key, def]) => [
        key,
        def.serverType,
      ]),
    ) as ServerShape,
  )
  .partial();

export type Settings = z.infer<typeof knownSettings>;

export async function getSettings(): Promise<Settings> {
  "use cache";
  cacheLife("minutes");
  cacheTag("settings");

  const db = getDb();
  const rows = await db.select().from(setting);
  const raw = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return knownSettings.parse(raw);
}

async function upsertSetting(key: string, value: string) {
  const db = getDb();
  await db
    .insert(setting)
    .values({ key, value })
    .onConflictDoUpdate({ target: setting.key, set: { value } });
}

export async function saveSettings(data: Record<string, string>) {
  await Promise.all(
    Object.keys(settingsRegistry)
      .filter((key) => key in data)
      .map((key) => upsertSetting(key, data[key]!)),
  );
  updateTag("settings");
}

export function hasBankDetails(
  s: Settings,
): s is Settings & { iban: string; bank_name: string; account_holder: string } {
  return Boolean(s.iban && s.bank_name && s.account_holder);
}

export function paymentDeadlineDays(s: Settings): number {
  return s.payment_deadline_days ?? 7;
}
