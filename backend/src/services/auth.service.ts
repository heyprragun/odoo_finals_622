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

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash,
      role: input.role,
    },
  });

  const token = generateToken({ sub: user.id, role: user.role });

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

  const token = generateToken({ sub: user.id, role: user.role });

  return { user: sanitizeUser(user), token };
}
