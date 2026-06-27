import { formOptions } from "@tanstack/react-form-nextjs";
import { z } from "zod";

export const settingsFormOpts = formOptions({
  defaultValues: {
    account_holder: "",
    iban: "",
    bank_name: "",
    payment_deadline_days: "" as string,
    price_per_night: "" as string,
  },
});

export const settingsFormClientSchema = z.object({
  account_holder: z.string().min(1, "Vereist"),
  iban: z.string().min(1, "Vereist"),
  bank_name: z.string().min(1, "Vereist"),
  payment_deadline_days: z
    .string()
    .min(1, "Vereist")
    .refine((v) => Number.isInteger(Number(v)) && Number(v) >= 1, {
      message: "Moet minstens 1 zijn",
    }),
  price_per_night: z
    .string()
    .min(1, "Vereist")
    .refine((v) => Number(v) > 0, { message: "Moet positief zijn" }),
});

// Server receives strings for all fields (no coercion needed); schema is currently identical to client.
export const settingsFormServerSchema = settingsFormClientSchema;

export type SettingsFormValues = z.infer<typeof settingsFormClientSchema>;
