import { formOptions } from "@tanstack/react-form-nextjs";
import { z } from "zod";

export const poiFormOpts = formOptions({
  defaultValues: {
    title: "",
    body: "",
    distanceKm: "" as string,
    published: false as boolean,
  },
});

export const poiFormClientSchema = z.object({
  title: z.string().min(1, "Vereist"),
  body: z.string().min(1, "Vereist"),
  distanceKm: z.string(),
  published: z.boolean(),
});

// Server schema handles FormData strings
export const poiFormServerSchema = z.object({
  title: z.string().min(1, "Vereist"),
  body: z.string().min(1, "Vereist"),
  distanceKm: z.string().optional(),
  published: z.preprocess((v) => v === "true" || v === true, z.boolean()),
});

export type PoiFormValues = z.infer<typeof poiFormClientSchema>;
