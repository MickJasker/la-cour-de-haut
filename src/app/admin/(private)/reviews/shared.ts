import { formOptions } from "@tanstack/react-form-nextjs";
import { z } from "zod";

// The original language the guest wrote in. The picker offers the four display
// locales plus "und" (Andere taal → auto-detect), but the stored value is a
// free BCP-47 string because auto-detect may resolve to a wider language (e.g.
// "it") that must survive an edit round-trip. See ADR-0014.
export const KNOWN_ORIGINAL_LOCALES = ["nl", "en", "fr", "de", "und"] as const;
export const originalLocaleSchema = z.string().min(1, "Vereist");

export const reviewFormOpts = formOptions({
  defaultValues: {
    authorName: "",
    rating: 5 as number,
    reviewDate: "",
    source: "airbnb" as "airbnb" | "natuurhuisje" | "direct" | "google",
    originalLocale: "nl" as string,
    originalBody: "",
    translations: {} as { nl?: string; en?: string; fr?: string; de?: string },
    published: false as boolean,
  },
});

// The display-locale projection filled by auto-translate. Every key optional.
export const translationsSchema = z.object({
  nl: z.string().optional(),
  en: z.string().optional(),
  fr: z.string().optional(),
  de: z.string().optional(),
});

export const reviewFormClientSchema = z.object({
  authorName: z.string().min(1, "Vereist"),
  rating: z.number().int().min(1).max(5),
  reviewDate: z.string().min(1, "Vereist"),
  source: z.enum(["airbnb", "natuurhuisje", "direct", "google"]),
  originalLocale: originalLocaleSchema,
  originalBody: z.string().min(1, "Vereist"),
  translations: translationsSchema,
  published: z.boolean(),
});

// Server schema handles FormData strings (numbers and booleans come in as
// strings); translations is JSON-encoded by the client.
const parseJson = (v: unknown) => {
  if (typeof v === "string") {
    try {
      return JSON.parse(v);
    } catch {
      return v;
    }
  }
  return v;
};

export const reviewFormServerSchema = z.object({
  authorName: z.string().min(1, "Vereist"),
  rating: z.coerce.number().int().min(1).max(5),
  reviewDate: z
    .string()
    .min(1, "Vereist")
    .regex(/^\d{4}-\d{2}-\d{2}/, "Ongeldige datum"),
  source: z.enum(["airbnb", "natuurhuisje", "direct", "google"]),
  originalLocale: originalLocaleSchema,
  originalBody: z.string().min(1, "Vereist"),
  translations: z.preprocess(parseJson, translationsSchema),
  published: z.preprocess((v) => v === "true" || v === true, z.boolean()),
});

export type ReviewFormValues = z.infer<typeof reviewFormClientSchema>;
