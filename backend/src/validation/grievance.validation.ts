import { z } from "zod";

export const createGrievanceSchema = z.object({
  quoteId: z.string().uuid("Invalid order id"),
  description: z.string().trim().min(1, "Please describe the issue you're facing").max(2000),
});

export const addGrievanceMessageSchema = z.object({
  message: z.string().trim().min(1, "Message cannot be empty").max(2000),
});

export type CreateGrievanceInput = z.infer<typeof createGrievanceSchema>;
export type AddGrievanceMessageInput = z.infer<typeof addGrievanceMessageSchema>;
