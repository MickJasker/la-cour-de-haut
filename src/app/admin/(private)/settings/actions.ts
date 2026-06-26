"use server";
import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/dal";
import { upsertSetting } from "@/lib/settings";

export async function saveSettingsAction(formData: FormData) {
  await verifySession();

  const keys = [
    "iban",
    "bank_name",
    "account_holder",
    "payment_deadline_days",
    "price_per_night",
  ];
  await Promise.all(
    keys
      .filter((k) => {
        const v = formData.get(k);
        return v !== null && String(v).trim() !== "";
      })
      .map((k) => upsertSetting(k, String(formData.get(k)))),
  );

  revalidatePath("/admin/settings");
}
