/**
 * roles.service.singleton.ts — Shared RolesService instance for consumers that
 * only need read-side API (`exists`, `listRoles`, `getRole`) and cannot inject
 * their own dependencies, e.g. Zod schema factories (D.9).
 *
 * Why a separate file? `members.validation.ts` runs at schema-build time and
 * must stay free of Clerk/Prisma wiring for unit tests. Having a tiny module
 * whose only export is the configured singleton keeps the `vi.mock(...)`
 * surface minimal (one target), and keeps `RolesService` constructor-pure.
 *
 * `getCallerRoleSlug` is intentionally a no-op here. That dependency is ONLY
 * needed for the self-lock guard on `RolesService.updateRole`, which is
 * wired from the API route (see roles/[roleSlug]/route.ts). The validation
 * layer only ever calls `exists`.
 */
import "server-only";
import { RolesRepository } from "./roles.repository";
import { RolesService } from "./roles.service";

export const rolesService = new RolesService({
  repo: new RolesRepository(),
  getCallerRoleSlug: async () => null,
});
