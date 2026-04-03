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
}
