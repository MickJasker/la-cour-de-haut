import "server-only";
import { z } from "zod";
import { getDb } from "@/db";
import { setting } from "@/db/schema";
import { cacheLife, cacheTag, updateTag } from "next/cache";
import { settingsRegistry, type ServerShape } from "./registry";
import type { PaymentScheduleSettings } from "@/lib/booking/payment-schedule";

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

/**
 * The payment-schedule knobs for `computePaymentSchedule`
 * (`src/lib/booking/payment-schedule.ts`), with the issue-#162 defaults
 * (50% / 3 days / 7 days) as fallbacks for missing keys. The keys are also
 * seeded by `scripts/seed-property-settings.mts`, so the fallbacks only
 * matter for rows deleted out-of-band.
 */
export function paymentScheduleSettings(s: Settings): PaymentScheduleSettings {
  return {
    depositPercentage: s.deposit_percentage ?? 50,
    depositDeadlineDays: s.deposit_deadline_days ?? 3,
    balanceDueDaysBeforeArrival: s.balance_due_days_before_arrival ?? 7,
  };
}

/** The borg: a fixed EUR amount charged with the final payment. */
export function securityDepositAmount(s: Settings): number {
  return s.security_deposit_amount ?? 0;
}
