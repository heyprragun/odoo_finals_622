import { z } from "zod";

export const createWarehouseSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  location: z.string().trim().min(1, "Location is required").max(120),
});

export type CreateWarehouseInput = z.infer<typeof createWarehouseSchema>;
