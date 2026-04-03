import { BaseRepository } from "@/features/shared/base.repository";
import type { Organization, OrganizationMember } from "@/generated/prisma/client";
import type {
  AddMemberInput,
  CreateOrganizationInput,
  OrganizationWithMembers,
} from "./organizations.types";

export class OrganizationsRepository extends BaseRepository {
  // -----------------------------------------------------------------------
  // Organization look-ups (no org-scoping needed)
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
  // Organization mutations
  // -----------------------------------------------------------------------

  async create(data: CreateOrganizationInput): Promise<Organization> {
    return this.db.organization.create({
      data: {
        clerkOrgId: data.clerkOrgId,
        name: data.name,
        slug: data.slug ?? data.name.toLowerCase().replace(/\s+/g, "-"),
      },
    });
  }

  // -----------------------------------------------------------------------
  // Member queries (org-scoped)
  // -----------------------------------------------------------------------

  async getMembers(organizationId: string): Promise<OrganizationWithMembers> {
    const scope = this.requireOrg(organizationId);
    const org = await this.db.organization.findUniqueOrThrow({
      where: { id: scope.organizationId },
      include: { members: { include: { user: true } } },
    });
    return org as OrganizationWithMembers;
  }

  async getOrgWithDocStats(organizationId: string) {
    const scope = this.requireOrg(organizationId);
    const [org, analyzedCount] = await Promise.all([
      this.db.organization.findUniqueOrThrow({
        where: { id: scope.organizationId },
        include: {
          _count: { select: { documents: true, members: true } },
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
      },
    });
  }

  async findMemberByClerkUserIdWithUser(
    organizationId: string,
    clerkUserId: string,
  ) {
    const scope = this.requireOrg(organizationId);
    return this.db.organizationMember.findFirst({
      where: { ...scope, user: { clerkUserId } },
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
      },
    });
  }

  async addMember(data: AddMemberInput): Promise<OrganizationMember> {
    const scope = this.requireOrg(data.organizationId);
    return this.db.organizationMember.create({
      data: {
        organizationId: scope.organizationId,
        userId: data.userId,
        role: data.role ?? "member",
      },
    });
  }

  // -----------------------------------------------------------------------
  // Member management
  // -----------------------------------------------------------------------

  async findMemberById(organizationId: string, memberId: string) {
    const scope = this.requireOrg(organizationId);
    return this.db.organizationMember.findFirst({
      where: { id: memberId, ...scope },
      include: { user: true },
    });
  }

  async findMemberByEmail(organizationId: string, email: string) {
    const scope = this.requireOrg(organizationId);
    return this.db.organizationMember.findFirst({
      where: { ...scope, user: { email } },
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

  async removeMember(
    organizationId: string,
    memberId: string,
  ): Promise<OrganizationMember> {
    const scope = this.requireOrg(organizationId);
    return this.db.organizationMember.delete({
      where: { id: memberId, ...scope },
    });
  }
}
