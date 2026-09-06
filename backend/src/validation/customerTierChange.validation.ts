import { z } from "zod";

export const decideTierChangeSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  note: z.string().trim().max(1000).optional(),
});

export type DecideTierChangeInput = z.infer<typeof decideTierChangeSchema>;
