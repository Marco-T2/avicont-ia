import type { CustomRole, Prisma } from "@/generated/prisma/client";

export type CreateCustomRoleInput = {
  organizationId: string;
  slug: string;
  name: string;
  description?: string | null;
  isSystem: boolean;
  permissionsRead: string[];
  permissionsWrite: string[];
  canPost: string[];
};

export type UpdateCustomRolePatch = Partial<{
  name: string;
  description: string | null;
  permissionsRead: string[];
  permissionsWrite: string[];
  canPost: string[];
}>;

/**
 * Read/write port for the CustomRole entity.
 *
 * Mirror: modules/dispatch/domain/ports/dispatch.repository.ts pattern.
 */
export interface RolesRepositoryPort {
  findAllByOrg(organizationId: string): Promise<CustomRole[]>;

  findBySlug(
    organizationId: string,
    slug: string,
  ): Promise<CustomRole | null>;

  create(data: CreateCustomRoleInput): Promise<CustomRole>;

  update(
    organizationId: string,
    id: string,
    patch: UpdateCustomRolePatch,
  ): Promise<CustomRole>;

  delete(organizationId: string, id: string): Promise<CustomRole>;

  /**
   * Count active OrganizationMember rows that currently carry the given role slug.
   * Used by the delete guard (CR.7) -- a role with members assigned cannot be
   * deleted.
   */
  countMembers(roleSlug: string, organizationId: string): Promise<number>;
}
