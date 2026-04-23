import "server-only";
import { BaseRepository } from "@/features/shared/base.repository";
import type { Organization, OrganizationMember, Prisma } from "@/generated/prisma/client";
import type {
  AddMemberInput,
  CreateOrganizationInput,
  OrganizationWithMembers,
} from "./organizations.types";

export class OrganizationsRepository extends BaseRepository {
  // -----------------------------------------------------------------------
  // Búsquedas de organización (no requieren org-scoping)
  // -----------------------------------------------------------------------

  async findById(id: string): Promise<Organization | null> {
    return this.db.organization.findUnique({ where: { id } });
  }

  async findBySlug(slug: string): Promise<Organization | null> {
    return this.db.organization.findUnique({ where: { slug } });
  }

  async findByClerkId(clerkOrgId: string): Promise<Organization | null> {
    return this.db.organization.findUnique({ where: { clerkOrgId } });
  }

  // -----------------------------------------------------------------------
  // Mutaciones de organización
  // -----------------------------------------------------------------------

  async create(
    data: CreateOrganizationInput,
    tx?: Prisma.TransactionClient,
  ): Promise<Organization> {
    const db = tx ?? this.db;
    return db.organization.create({
      data: {
        clerkOrgId: data.clerkOrgId,
        name: data.name,
        slug: data.slug ?? data.name.toLowerCase().replace(/\s+/g, "-"),
      },
    });
  }

  // -----------------------------------------------------------------------
  // Consultas de miembros (con org-scoping)
  // -----------------------------------------------------------------------

  async getMembers(organizationId: string): Promise<OrganizationWithMembers> {
    const scope = this.requireOrg(organizationId);
    const org = await this.db.organization.findUniqueOrThrow({
      where: { id: scope.organizationId },
      include: { members: { where: { deactivatedAt: null }, include: { user: true } } },
    });
    return org as OrganizationWithMembers;
  }

  async getOrgWithDocStats(organizationId: string) {
    const scope = this.requireOrg(organizationId);
    const [org, analyzedCount] = await Promise.all([
      this.db.organization.findUniqueOrThrow({
        where: { id: scope.organizationId },
        include: {
          _count: { select: { documents: true, members: { where: { deactivatedAt: null } } } },
          documents: { take: 5, orderBy: { createdAt: "desc" } },
        },
      }),
      this.db.document.count({
        where: {
          organizationId: scope.organizationId,
          aiSummary: { not: null },
        },
      }),
    ]);
    return { org, analyzedCount };
  }

  async findMember(
    organizationId: string,
    userId: string,
  ): Promise<OrganizationMember | null> {
    const scope = this.requireOrg(organizationId);
    return this.db.organizationMember.findFirst({
      where: {
        ...scope,
        userId,
        deactivatedAt: null,
      },
    });
  }

  async findMemberByClerkUserId(
    organizationId: string,
    clerkUserId: string,
  ): Promise<OrganizationMember | null> {
    const scope = this.requireOrg(organizationId);
    return this.db.organizationMember.findFirst({
      where: {
        ...scope,
        user: { clerkUserId },
        deactivatedAt: null,
      },
    });
  }

  async findMemberByClerkUserIdWithUser(
    organizationId: string,
    clerkUserId: string,
  ) {
    const scope = this.requireOrg(organizationId);
    return this.db.organizationMember.findFirst({
      where: { ...scope, user: { clerkUserId }, deactivatedAt: null },
      include: { user: { select: { id: true } } },
    });
  }

  async findMemberByClerkUserIdAndRoles(
    organizationId: string,
    clerkUserId: string,
    roles: string[],
  ): Promise<OrganizationMember | null> {
    const scope = this.requireOrg(organizationId);
    return this.db.organizationMember.findFirst({
      where: {
        ...scope,
        user: { clerkUserId },
        role: { in: roles },
        deactivatedAt: null,
      },
    });
  }

  async addMember(
    data: AddMemberInput,
    tx?: Prisma.TransactionClient,
  ): Promise<OrganizationMember> {
    const scope = this.requireOrg(data.organizationId);
    const db = tx ?? this.db;
    return db.organizationMember.create({
      data: {
        organizationId: scope.organizationId,
        userId: data.userId,
        role: data.role ?? "member",
      },
    });
  }

  // -----------------------------------------------------------------------
  // Gestión de miembros
  // -----------------------------------------------------------------------

  async findMemberById(organizationId: string, memberId: string) {
    const scope = this.requireOrg(organizationId);
    return this.db.organizationMember.findFirst({
      where: { id: memberId, ...scope, deactivatedAt: null },
      include: { user: true },
    });
  }

  async findMemberByEmail(
    organizationId: string,
    email: string,
    includeDeactivated = false,
  ) {
    const scope = this.requireOrg(organizationId);
    return this.db.organizationMember.findFirst({
      where: {
        ...scope,
        user: { email },
        ...(includeDeactivated ? {} : { deactivatedAt: null }),
      },
      include: { user: true },
    });
  }

  async updateMemberRole(
    organizationId: string,
    memberId: string,
    role: string,
  ): Promise<OrganizationMember> {
    const scope = this.requireOrg(organizationId);
    return this.db.organizationMember.update({
      where: { id: memberId, ...scope },
      data: { role },
    });
  }

  async deactivateMember(
    organizationId: string,
    memberId: string,
  ): Promise<OrganizationMember> {
    const scope = this.requireOrg(organizationId);
    return this.db.organizationMember.update({
      where: { id: memberId, ...scope },
      data: { deactivatedAt: new Date() },
    });
  }

  async reactivateMember(
    memberId: string,
    role: string,
  ): Promise<OrganizationMember> {
    return this.db.organizationMember.update({
      where: { id: memberId },
      data: { deactivatedAt: null, role },
    });
  }
}
