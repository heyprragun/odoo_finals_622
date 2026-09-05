import { z } from "zod";

export const approveActionSchema = z.object({
  note: z.string().trim().max(1000).optional(),
});

export const returnOrRejectActionSchema = z.object({
  note: z
    .string()
    .trim()
    .min(3, "A note is required explaining this decision")
    .max(1000),
});

export type ApproveActionInput = z.infer<typeof approveActionSchema>;
export type ReturnOrRejectActionInput = z.infer<typeof returnOrRejectActionSchema>;
