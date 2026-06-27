"use server";

import {
  createServerValidate,
  ServerValidateError,
  initialFormState,
} from "@tanstack/react-form-nextjs";
import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/dal";
import { upsertSetting } from "@/lib/settings";
import { settingsFormOpts, settingsFormServerSchema } from "./shared";

export type SettingsActionState = {
  success: boolean;
  errorMap: { onServer?: unknown };
  values: unknown;
  errors: unknown[];
};

const serverValidate = createServerValidate({
  ...settingsFormOpts,
  onServerValidate: ({ value }) => {
    const result = settingsFormServerSchema.safeParse(value);
    if (!result.success) {
      return result.error.issues[0]?.message ?? "Validatie mislukt";
    }
  },
});

export async function saveSettingsAction(
  _prev: unknown,
  formData: FormData,
): Promise<SettingsActionState> {
  await verifySession();
  try {
    const data = await serverValidate(formData);
    await Promise.all([
      upsertSetting("account_holder", data.account_holder),
      upsertSetting("iban", data.iban),
      upsertSetting("bank_name", data.bank_name),
      upsertSetting("payment_deadline_days", data.payment_deadline_days),
      upsertSetting("price_per_night", data.price_per_night),
    ]);
    revalidatePath("/admin/settings");
    return { ...initialFormState, success: true };
  } catch (e) {
    if (e instanceof ServerValidateError) {
      return { ...e.formState, success: false };
    }
    throw e;
  }
}
