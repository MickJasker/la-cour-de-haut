import { formOptions } from "@tanstack/react-form-nextjs";
import { z } from "zod";

export const contentFormOpts = formOptions({
  defaultValues: {
    nl: "",
  },
});

export const contentFormClientSchema = z.object({
  nl: z.string().min(1, "Vereist"),
});

export const contentFormServerSchema = contentFormClientSchema;

export type ContentFormValues = z.infer<typeof contentFormClientSchema>;
