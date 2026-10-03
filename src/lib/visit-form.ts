import { z } from "zod";

export function todayInManila(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
}

// Photos per experience; they upload one at a time after the experience is saved.
export const MAX_VISIT_PHOTOS = 6;

export const visitFormSchema = z.object({
  placeId: z.string().min(1, "Choose a place.").max(80),
  visitedOn: z.iso.date("Enter a valid visit date.")
    .refine((value) => value <= todayInManila(), "Choose today or an earlier date."),
  story: z
    .string()
    .trim()
    .min(20, "Share at least 20 characters from the experience.")
    .max(1200),
  rating: z.number().int().min(1, "Choose a rating.").max(5),
  reflection: z
    .string()
    .trim()
    .min(8, "Add a short private reflection.")
    .max(500),
  revisit: z.enum(["yes", "maybe", "no"]),
  privateToMembers: z.literal(true, {
    error: "Experiences must remain private to the two members.",
  }),
});

export type VisitFormInput = z.infer<typeof visitFormSchema>;

export const publishVisitSchema = visitFormSchema.extend({
  idempotencyKey: z.uuid(),
  title: z.string().trim().min(1).max(160),
  exhibition: z.string().trim().max(160),
  // Photos and their descriptions are uploaded separately, after the experience exists.
  photoAlt: z.literal("", { error: "Send photos to the photo upload instead." }).optional(),
});

export const submitReviewSchema = visitFormSchema.pick({
  rating: true, reflection: true, revisit: true,
});
