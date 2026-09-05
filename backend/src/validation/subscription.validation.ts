import { z } from "zod";

export const optionalNoteSchema = z.object({
  note: z.string().trim().max(1000).optional(),
});

export const changeQuantitySchema = z.object({
  quantity: z.number().int("Quantity must be a whole number").positive("Quantity must be positive"),
});

export type OptionalNoteInput = z.infer<typeof optionalNoteSchema>;
export type ChangeQuantityInput = z.infer<typeof changeQuantitySchema>;
