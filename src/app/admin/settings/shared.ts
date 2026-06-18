import { formOptions } from "@tanstack/react-form-nextjs";
import { z } from "zod";

export const sourceFormOpts = formOptions({
  defaultValues: {
    name: "",
    url: "",
    enabled: true as boolean,
  },
});

// Used with validators.onDynamic — receives actual JS values from form state
export const sourceFormClientSchema = z.object({
  name: z.string().min(1, "Name is required"),
  url: z.string().url("Must be a valid URL"),
  enabled: z.boolean(),
});

// Used in onServerValidate — receives raw FormData strings
export const sourceFormServerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  url: z.string().url("Must be a valid URL"),
  enabled: z.preprocess((v) => v === "true" || v === true, z.boolean()),
});

export type SourceFormValues = z.infer<typeof sourceFormClientSchema>;
