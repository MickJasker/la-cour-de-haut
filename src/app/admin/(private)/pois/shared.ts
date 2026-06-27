import { formOptions } from "@tanstack/react-form-nextjs";
import { z } from "zod";

export const poiFormOpts = formOptions({
  defaultValues: {
    title: { nl: "" } as { nl: string; en?: string; fr?: string; de?: string },
    body: { nl: "" } as { nl: string; en?: string; fr?: string; de?: string },
    distanceKm: "" as string,
    published: false as boolean,
  },
});

export const localizedStringSchema = z.object({
  nl: z.string().min(1, "Vereist"),
  en: z.string().optional(),
  fr: z.string().optional(),
  de: z.string().optional(),
});

export const poiFormClientSchema = z.object({
  title: localizedStringSchema,
  body: localizedStringSchema,
  distanceKm: z.string(),
  published: z.boolean(),
});

// Server schema handles FormData strings — title/body are JSON-encoded by the client
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

export const poiFormServerSchema = z.object({
  title: z.preprocess(parseJson, localizedStringSchema),
  body: z.preprocess(parseJson, localizedStringSchema),
  distanceKm: z.string().optional(),
  published: z.preprocess((v) => v === "true" || v === true, z.boolean()),
});

export type PoiFormValues = z.infer<typeof poiFormClientSchema>;
