"use server";
import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/dal";
import { upsertSetting } from "@/lib/settings";

export async function saveSettingsAction(formData: FormData) {
  await verifySession();

  const keys = ["iban", "bank_name", "account_holder", "payment_deadline_days"];
  await Promise.all(
    keys
      .filter((k) => formData.get(k) !== null)
      .map((k) => upsertSetting(k, String(formData.get(k)))),
  );

  revalidatePath("/admin/settings");
}
