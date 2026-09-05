import type { User } from "@prisma/client";

export type SafeUser = Omit<User, "passwordHash">;

export function sanitizeUser(user: User): SafeUser {
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}
