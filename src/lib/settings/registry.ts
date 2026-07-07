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
 * Server-side type for an OPTIONAL numeric setting. A blank (or absent) value
 * parses to `undefined`, never `0` — critical for the SEO enrichment fields,
 * where a spurious `0` would emit e.g. `geo: 0,0` (the Gulf of Guinea) instead
 * of omitting the field.
 */
const optionalNumber = z.preprocess(
  (v) => (v === "" || v == null ? undefined : v),
  z.coerce.number().optional(),
);

/** Client-side validator for an optional number, with an inclusive range. */
const optionalNumberInRange = (min: number, max: number) =>
  z
    .string()
    .refine(
      (v) => v === "" || (Number.isFinite(Number(v)) && +v >= min && +v <= max),
      `Getal tussen ${min} en ${max}`,
    );

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
  property_latitude: {
    label: "Breedtegraad (latitude)",
    section: "gite_details",
    inputType: "text",
    placeholder: "48.6123",
    hint: "Optioneel. In Google Maps: rechtermuisklik op de locatie → coördinaten. Vul beide velden in voor de kaartvermelding.",
    clientValidation: optionalNumberInRange(-90, 90),
    serverType: optionalNumber,
  },
  property_longitude: {
    label: "Lengtegraad (longitude)",
    section: "gite_details",
    inputType: "text",
    placeholder: "-1.0456",
    clientValidation: optionalNumberInRange(-180, 180),
    serverType: optionalNumber,
  },
  property_bedrooms: {
    label: "Aantal slaapkamers",
    section: "gite_details",
    inputType: "number",
    min: 1,
    placeholder: "3",
    hint: "Optioneel. Getoond in de gestructureerde SEO-data.",
    clientValidation: optionalNumberInRange(1, 50),
    serverType: optionalNumber,
  },
  property_checkin_time: {
    label: "Inchecktijd",
    section: "gite_details",
    inputType: "text",
    placeholder: "16:00",
    hint: "Optioneel, formaat uu:mm.",
    clientValidation: z
      .string()
      .refine(
        (v) => v === "" || /^([01]\d|2[0-3]):[0-5]\d$/.test(v),
        "Gebruik formaat uu:mm",
      ),
    serverType: z.string(),
  },
  property_checkout_time: {
    label: "Uitchecktijd",
    section: "gite_details",
    inputType: "text",
    placeholder: "10:00",
    clientValidation: z
      .string()
      .refine(
        (v) => v === "" || /^([01]\d|2[0-3]):[0-5]\d$/.test(v),
        "Gebruik formaat uu:mm",
      ),
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
  deposit_percentage: {
    label: "Aanbetaling (%)",
    section: "payment_schedule",
    inputType: "number",
    min: 1,
    max: 100,
    placeholder: "50",
    hint: "Percentage van de totaalprijs dat de gast als aanbetaling betaalt.",
    clientValidation: z
      .string()
      .min(1, "Vereist")
      .refine(
        (v) =>
          Number.isInteger(Number(v)) && Number(v) >= 1 && Number(v) <= 100,
        { message: "Geheel getal tussen 1 en 100" },
      ),
    serverType: z.coerce.number().int().min(1).max(100),
  },
  deposit_deadline_days: {
    label: "Termijn aanbetaling (dagen)",
    section: "payment_schedule",
    inputType: "number",
    min: 1,
    max: 90,
    placeholder: "3",
    hint: "Aantal dagen na bevestiging dat de gast heeft om de aanbetaling te doen.",
    clientValidation: z
      .string()
      .min(1, "Vereist")
      .refine((v) => Number.isInteger(Number(v)) && Number(v) >= 1, {
        message: "Moet minstens 1 zijn",
      }),
    serverType: z.coerce.number().int().positive(),
  },
  balance_due_days_before_arrival: {
    label: "Restbetaling vóór aankomst (dagen)",
    section: "payment_schedule",
    inputType: "number",
    min: 1,
    max: 90,
    placeholder: "7",
    hint: "Aantal dagen vóór aankomst dat de restbetaling (incl. borg) binnen moet zijn.",
    clientValidation: z
      .string()
      .min(1, "Vereist")
      .refine((v) => Number.isInteger(Number(v)) && Number(v) >= 1, {
        message: "Moet minstens 1 zijn",
      }),
    serverType: z.coerce.number().int().positive(),
  },
  security_deposit_amount: {
    label: "Borg (€)",
    section: "payment_schedule",
    inputType: "number",
    min: 0,
    step: 0.01,
    placeholder: "200",
    hint: "Vast bedrag dat de gast samen met de laatste betaling voldoet en na het verblijf terugkrijgt. 0 betekent geen borg.",
    clientValidation: z
      .string()
      .min(1, "Vereist")
      .refine((v) => Number.isFinite(Number(v)) && Number(v) >= 0, {
        message: "Mag niet negatief zijn",
      }),
    serverType: z.coerce.number().min(0),
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
  gite_details: {
    label: "Gîte-details (SEO)",
    description:
      "Optionele gegevens die de vindbaarheid verbeteren via gestructureerde data. Leeg laten mag — lege velden worden weggelaten.",
  },
  bank: {
    label: "Bankgegevens",
    description:
      "Deze gegevens worden opgenomen in de overschrijvingse-mail die naar gasten wordt verstuurd wanneer u een boeking bevestigt.",
  },
  payment_schedule: {
    label: "Betalingsschema",
    description:
      "Bepaalt hoe de totaalprijs wordt gesplitst in een aanbetaling en een restbetaling (incl. borg), en de bijbehorende betaaltermijnen. Bij korte termijn tussen bevestiging en aankomst wordt alles in één keer gevraagd.",
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
