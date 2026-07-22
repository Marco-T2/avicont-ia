import type { User } from "@/modules/users/domain/user.types";

/** Input for creating a user from Clerk data. */
export interface CreateUserInput {
  clerkUserId: string;
  email: string;
  name?: string | null;
}

/**
 * Domain port that decouples the users application service from the concrete
 * Prisma-backed repository (hex R2). Typed against the domain `User` mirror so
 * the application layer stays Prisma-free; the infrastructure repository
 * implements it and is wired in `presentation/composition-root.ts`.
 */
export interface UsersRepositoryPort {
  findByClerkUserId(clerkUserId: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(data: CreateUserInput): Promise<User>;
  update(id: string, data: { email?: string; name?: string | null }): Promise<User>;
}
