import { formOptions } from "@tanstack/react-form-nextjs";
import { z } from "zod";

export const contentFormOpts = formOptions({
  defaultValues: {
    nl: "",
    en: "",
    fr: "",
    de: "",
    enSource: null as "human" | "machine" | null,
    frSource: null as "human" | "machine" | null,
    deSource: null as "human" | "machine" | null,
  },
});

export const contentFormClientSchema = z.object({
  nl: z.string().min(1, "Vereist"),
  en: z.string(),
  fr: z.string(),
  de: z.string(),
  enSource: z.enum(["human", "machine"]).nullable(),
  frSource: z.enum(["human", "machine"]).nullable(),
  deSource: z.enum(["human", "machine"]).nullable(),
});

export const contentFormServerSchema = contentFormClientSchema;

export type ContentFormValues = z.infer<typeof contentFormClientSchema>;
