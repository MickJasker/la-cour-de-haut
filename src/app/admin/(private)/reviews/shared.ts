import { formOptions } from "@tanstack/react-form-nextjs";
import { z } from "zod";

export const reviewFormOpts = formOptions({
  defaultValues: {
    authorName: "",
    rating: 5 as number,
    reviewDate: "",
    source: "airbnb" as "airbnb" | "natuurhuisje" | "direct",
    body: "",
    published: false as boolean,
  },
});

export const reviewFormClientSchema = z.object({
  authorName: z.string().min(1, "Vereist"),
  rating: z.number().int().min(1).max(5),
  reviewDate: z.string().min(1, "Vereist"),
  source: z.enum(["airbnb", "natuurhuisje", "direct"]),
  body: z.string().min(1, "Vereist"),
  published: z.boolean(),
});

// Server schema handles FormData strings (numbers and booleans come in as strings)
export const reviewFormServerSchema = z.object({
  authorName: z.string().min(1, "Vereist"),
  rating: z.coerce.number().int().min(1).max(5),
  reviewDate: z
    .string()
    .min(1, "Vereist")
    .regex(/^\d{4}-\d{2}-\d{2}/, "Ongeldige datum"),
  source: z.enum(["airbnb", "natuurhuisje", "direct"]),
  body: z.string().min(1, "Vereist"),
  published: z.preprocess((v) => v === "true" || v === true, z.boolean()),
});

export type ReviewFormValues = z.infer<typeof reviewFormClientSchema>;
