import { z } from "zod";

export const dealHealthActionSchema = z.object({
  note: z.string().trim().min(3, "A note is required explaining this decision").max(1000),
});

export type DealHealthActionInput = z.infer<typeof dealHealthActionSchema>;
