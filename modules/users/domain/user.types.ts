/**
 * Domain-owned structural type for the users module (D4 — mirrors the Prisma
 * `User` model scalars, following the precedent set by
 * `modules/organizations/domain/types.ts`).
 *
 * Structural on purpose: rows returned by the Prisma-backed repository satisfy
 * this interface without casts, and the application layer stops importing the
 * Prisma model type (hex R5). Relations are deliberately omitted — the users
 * service only traffics in scalars.
 */
export interface User {
  id: string;
  clerkUserId: string;
  email: string;
  name: string | null;
  createdAt: Date;
}
