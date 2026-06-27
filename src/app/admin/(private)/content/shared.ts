import { z } from "zod";

export const contentFormSchema = z.object({
  descriptionNl: z.string().min(1, "Vereist"),
  descriptionEn: z.string(),
  descriptionFr: z.string(),
  descriptionDe: z.string(),
});

export type ContentFormValues = z.infer<typeof contentFormSchema>;
