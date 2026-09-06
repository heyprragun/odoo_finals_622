import { z } from "zod";

export const addOrderCommentSchema = z.object({
  message: z.string().trim().min(1, "Message cannot be empty").max(2000),
});

export type AddOrderCommentInput = z.infer<typeof addOrderCommentSchema>;
