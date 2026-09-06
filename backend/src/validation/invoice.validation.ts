import { z } from "zod";

export const emailInvoiceSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
});

export type EmailInvoiceInput = z.infer<typeof emailInvoiceSchema>;
