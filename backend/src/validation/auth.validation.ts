import { z } from "zod";
import { Role } from "@prisma/client";

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, "Name must be at least 2 characters"),
    email: z.string().trim().toLowerCase().email("Invalid email address"),
    password: z
      .string(),
      // .min(8, "Password must be at least 8 characters")
      // .regex(/[a-z]/, "Password must contain a lowercase letter")
      // .regex(/[A-Z]/, "Password must contain an uppercase letter")
      // .regex(/[0-9]/, "Password must contain a number"),
    role: z.nativeEnum(Role, {
      errorMap: () => ({ message: `Role must be one of: ${Object.values(Role).join(", ")}` }),
    }),
    // Only meaningful (and required) when role is CUSTOMER - see the
    // .refine below. A Customer registrant is linked to this company,
    // reusing an existing one by name if it already exists.
    companyName: z.string().trim().min(2, "Company name must be at least 2 characters").max(200).optional(),
  })
  .refine((data) => data.role !== Role.CUSTOMER || Boolean(data.companyName), {
    message: "Company name is required when registering as a Customer",
    path: ["companyName"],
  });

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
