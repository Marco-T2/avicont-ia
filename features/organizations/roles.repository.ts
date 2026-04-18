/**
 * roles.repository.ts — Thin Prisma wrappers for CustomRole + member count.
 *
 * Scope: D.1 — Prisma schema access layer. NO business logic, no normalization,
 * no validation. The service layer owns the domain rules.
 *
 * Matches the existing `OrganizationsRepository` class pattern so consumers get
 * the same shape across the `features/organizations/` module.
 */
import { BaseRepository } from "@/features/shared/base.repository";
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

export class RolesRepository extends BaseRepository {
  async findAllByOrg(organizationId: string): Promise<CustomRole[]> {
    return this.db.customRole.findMany({
      where: { organizationId },
      orderBy: [{ isSystem: "desc" }, { slug: "asc" }],
    });
  }

  async findBySlug(
    organizationId: string,
    slug: string,
  ): Promise<CustomRole | null> {
    return this.db.customRole.findUnique({
      where: { organizationId_slug: { organizationId, slug } },
    });
  }

  async create(data: CreateCustomRoleInput): Promise<CustomRole> {
    return this.db.customRole.create({ data: data as Prisma.CustomRoleUncheckedCreateInput });
  }

  async update(
    id: string,
    patch: UpdateCustomRolePatch,
  ): Promise<CustomRole> {
    return this.db.customRole.update({
      where: { id },
      data: patch,
    });
  }

  async delete(id: string): Promise<CustomRole> {
    return this.db.customRole.delete({ where: { id } });
  }

  /**
   * Count active OrganizationMember rows that currently carry the given role slug.
   * Used by the delete guard (CR.7) — a role with members assigned cannot be
   * deleted.
   */
  async countMembers(roleSlug: string, organizationId: string): Promise<number> {
    return this.db.organizationMember.count({
      where: { organizationId, role: roleSlug },
    });
  }
}
