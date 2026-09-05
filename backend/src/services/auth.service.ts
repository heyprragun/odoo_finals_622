import { CustomerTier, Role } from "@prisma/client";
import { prisma } from "../config/prisma";
import { hashPassword, comparePassword } from "../utils/password";
import { generateToken } from "../utils/jwt";
import { sanitizeUser, type SafeUser } from "../utils/sanitizeUser";
import { ApiError } from "../utils/ApiError";
import type { RegisterInput, LoginInput } from "../validation/auth.validation";

interface AuthResult {
  user: SafeUser;
  token: string;
}

export async function registerUser(input: RegisterInput): Promise<AuthResult> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw ApiError.conflict("An account with this email already exists");
  }

  const passwordHash = await hashPassword(input.password);

  // A Customer registrant is linked to a Customer company, reusing an
  // existing one by name (case-insensitive) so repeat registrations from
  // the same company join the same record instead of creating duplicates.
  // Brand-new companies default to BRONZE - sales can re-tier them later
  // the same way any other customer's tier gets managed.
  let customerId: string | null = null;
  if (input.role === Role.CUSTOMER) {
    const companyName = input.companyName!.trim();
    const existingCustomer = await prisma.customer.findFirst({
      where: { name: { equals: companyName, mode: "insensitive" } },
    });
    const customer =
      existingCustomer ??
      (await prisma.customer.create({ data: { name: companyName, tier: CustomerTier.BRONZE } }));
    customerId = customer.id;
  }

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash,
      role: input.role,
      customerId,
    },
  });

  const token = generateToken({ sub: user.id, role: user.role, customerId: user.customerId });

  return { user: sanitizeUser(user), token };
}

export async function loginUser(input: LoginInput): Promise<AuthResult> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) {
    throw ApiError.unauthorized("Invalid email or password");
  }

  const isValid = await comparePassword(input.password, user.passwordHash);
  if (!isValid) {
    throw ApiError.unauthorized("Invalid email or password");
  }

  const token = generateToken({ sub: user.id, role: user.role, customerId: user.customerId });

  return { user: sanitizeUser(user), token };
}
