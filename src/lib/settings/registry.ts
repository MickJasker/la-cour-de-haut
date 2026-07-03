import { z } from "zod";
import { isValidPhoneNumber } from "libphonenumber-js/min";

export interface FieldMeta {
  label: string;
  section: string;
  inputType: "text" | "number";
  placeholder?: string;
  hint?: string;
  min?: number;
  max?: number;
  step?: number;
  /** Client-side validation — form values are always strings */
  clientValidation: z.ZodType<string, string>;
  /** Server-side type — may use coercion for numeric fields */
  serverType: z.ZodTypeAny;
}

/**
 * Single source of truth for all settings.
 *
 * Use `satisfies` so TypeScript retains the narrow type of each entry
 * (e.g. ZodString rather than ZodTypeAny) while still checking the shape.
 * This lets downstream code derive schema types without losing per-field
 * type information.
 */
export const settingsRegistry = {
  property_telephone: {
    label: "Telefoonnummer",
    section: "contact",
    inputType: "text",
    placeholder: "+33 6 73 10 00 89",
    hint: "Internationaal formaat met landcode (bijv. +33…). Getoond in de header en in de zoekmachine-data.",
    // Same rule as the booking form (ADR-0013): required, then format-checked
    // as a composed E.164 number. Stored as E.164; formatted for display at
    // render time (see formatPhoneDisplay).
    clientValidation: z
      .string()
      .min(1, "Vereist")
      .refine(isValidPhoneNumber, "Ongeldig telefoonnummer"),
    serverType: z.string(),
  },
  property_email: {
    label: "E-mailadres",
    section: "contact",
    inputType: "text",
    placeholder: "info@lacourdehaut.fr",
    hint: "Getoond in de header en in de zoekmachine-data.",
    clientValidation: z
      .string()
      .min(1, "Vereist")
      .refine((v) => z.email().safeParse(v).success, "Ongeldig e-mailadres"),
    serverType: z.string(),
  },
  account_holder: {
    label: "Rekeninghouder",
    section: "bank",
    inputType: "text",
    placeholder: "La Cour de Haut",
    clientValidation: z.string().min(1, "Vereist"),
    serverType: z.string(),
  },
  iban: {
    label: "IBAN",
    section: "bank",
    inputType: "text",
    placeholder: "NL91 ABNA 0417 1643 00",
    clientValidation: z.string().min(1, "Vereist"),
    serverType: z.string(),
  },
  bank_name: {
    label: "Banknaam",
    section: "bank",
    inputType: "text",
    placeholder: "ABN AMRO",
    clientValidation: z.string().min(1, "Vereist"),
    serverType: z.string(),
  },
  payment_deadline_days: {
    label: "Betalingstermijn (dagen)",
    section: "bank",
    inputType: "number",
    min: 1,
    max: 90,
    hint: "Aantal dagen vanaf vandaag dat de gast heeft om te betalen wanneer u een boeking bevestigt.",
    clientValidation: z
      .string()
      .min(1, "Vereist")
      .refine((v) => Number.isInteger(Number(v)) && Number(v) >= 1, {
        message: "Moet minstens 1 zijn",
      }),
    serverType: z.coerce.number().int().positive(),
  },
  price_per_night: {
    label: "Prijs per nacht",
    section: "pricing",
    inputType: "number",
    min: 1,
    step: 0.01,
    clientValidation: z
      .string()
      .min(1, "Vereist")
      .refine((v) => Number(v) > 0, { message: "Moet positief zijn" }),
    serverType: z.coerce.number().positive(),
  },
} satisfies Record<string, FieldMeta>;

export type SettingKey = keyof typeof settingsRegistry;

export const allSettingKeys = Object.keys(settingsRegistry) as SettingKey[];

/** Display metadata for each section, in render order. */
export const sectionMeta: Record<
  string,
  { label: string; description?: string }
> = {
  contact: {
    label: "Contactgegevens",
    description:
      "Telefoon en e-mail zoals getoond in de header van de website en in de gestructureerde SEO-data.",
  },
  bank: {
    label: "Bankgegevens",
    description:
      "Deze gegevens worden opgenomen in de overschrijvingse-mail die naar gasten wordt verstuurd wanneer u een boeking bevestigt.",
  },
  pricing: {
    label: "Tarieven",
  },
};

/** Derive the Zod shape for server-side schema from the registry. */
export type ServerShape = {
  [K in SettingKey]: (typeof settingsRegistry)[K]["serverType"];
};

/** Derive the Zod shape for client-side form validation from the registry. */
export type ClientShape = {
  [K in SettingKey]: (typeof settingsRegistry)[K]["clientValidation"];
};
