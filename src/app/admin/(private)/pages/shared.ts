import { formOptions } from "@tanstack/react-form-nextjs";
import { z } from "zod";

// The rich body is kept out of this form-values shape (like POI detail) —
// it lives in local component state and is appended to FormData manually on
// submit. See pages-client.tsx.
export const pageFormOpts = formOptions({
  defaultValues: {
    title: { nl: "" } as { nl: string; en?: string; fr?: string; de?: string },
  },
});

export const localizedStringSchema = z.object({
  nl: z.string().min(1, "Vereist"),
  en: z.string().optional(),
  fr: z.string().optional(),
  de: z.string().optional(),
});

export const pageFormClientSchema = z.object({
  title: localizedStringSchema,
});

// Server schema handles FormData strings — title is JSON-encoded by the client.
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

export const pageFormServerSchema = z.object({
  title: z.preprocess(parseJson, localizedStringSchema),
});

export type PageFormValues = z.infer<typeof pageFormClientSchema>;
