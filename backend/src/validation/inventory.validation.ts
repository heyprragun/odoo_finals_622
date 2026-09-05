import { z } from "zod";

export const updateInventorySchema = z.object({
  entries: z
    .array(
      z.object({
        warehouseId: z.string().uuid("Invalid warehouse id"),
        quantityAvailable: z
          .number()
          .int("Quantity must be a whole number")
          .min(0, "Quantity cannot be negative"),
      })
    )
    .min(1, "At least one warehouse entry is required"),
});

export type UpdateInventoryInput = z.infer<typeof updateInventorySchema>;
