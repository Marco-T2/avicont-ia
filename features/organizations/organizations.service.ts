import { prisma } from "@/lib/prisma";
import {
  NotFoundError,
  ForbiddenError,
} from "@/features/shared/errors";
import { OrganizationsRepository } from "./organizations.repository";
import type { Organization, OrganizationMember } from "@/generated/prisma/client";
import type {
  CreateOrganizationInput,
  SyncOrganizationResult,
} from "./organizations.types";

export class OrganizationsService {
  constructor(
    private readonly repo: OrganizationsRepository = new OrganizationsRepository(),
  ) {}

  // -----------------------------------------------------------------------
  // Sync / create organization (idempotent — used by the route handler)
  // -----------------------------------------------------------------------

  async syncOrganization(
    input: CreateOrganizationInput,
    clerkUserId: string,
  ): Promise<SyncOrganizationResult> {
    // If the org already exists, return it without modifying anything
    const existing = await this.repo.findByClerkId(input.clerkOrgId);
    if (existing) {
      return { organization: existing, created: false };
    }

    // Ensure the calling user exists in our DB
    let user = await prisma.user.findUnique({
      where: { clerkUserId },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          clerkUserId,
          email: `${clerkUserId}@temp.com`,
          name: "User",
        },
      });
    }

    // Create the organization
    const organization = await this.repo.create(input);

    // Add the creator as owner
    await this.repo.addMember({
      userId: user.id,
      organizationId: organization.id,
      role: "owner",
    });

    return { organization, created: true };
  }

  // -----------------------------------------------------------------------
  // Look-ups
  // -----------------------------------------------------------------------

  async getBySlug(slug: string) {
    const org = await this.repo.findBySlug(slug);
    if (!org) throw new NotFoundError("Organización");
    return org;
  }

  async getById(id: string) {
    const org = await this.repo.findById(id);
    if (!org) throw new NotFoundError("Organización");
    return org;
  }

  async getByClerkId(clerkOrgId: string) {
    const org = await this.repo.findByClerkId(clerkOrgId);
    if (!org) throw new NotFoundError("Organización");
    return org;
  }

  // -----------------------------------------------------------------------
  // Membership
  // -----------------------------------------------------------------------

  async getOrgWithMembers(organizationId: string) {
    return this.repo.getMembers(organizationId);
  }

  async verifyMembership(
    clerkUserId: string,
    orgSlug: string,
  ): Promise<string> {
    const org = await this.repo.findBySlug(orgSlug);
    if (!org) throw new NotFoundError("Organización");

    const member = await this.repo.findMemberByClerkUserId(
      org.id,
      clerkUserId,
    );
    if (!member) throw new ForbiddenError();

    return org.id;
  }

  // -----------------------------------------------------------------------
  // Layout & dashboard data
  // -----------------------------------------------------------------------

  async getOrgLayoutData(
    slug: string,
    clerkUserId: string,
  ): Promise<{ organization: Organization; membership: OrganizationMember }> {
    const organization = await this.repo.findBySlug(slug);
    if (!organization) throw new NotFoundError("Organización");

    const membership = await this.repo.findMemberByClerkUserId(
      organization.id,
      clerkUserId,
    );
    if (!membership) throw new ForbiddenError();

    return { organization, membership };
  }

  async getDashboardData(orgId: string, clerkUserId: string) {
    const [{ org, analyzedCount }, membership] = await Promise.all([
      this.repo.getOrgWithDocStats(orgId),
      this.repo.findMemberByClerkUserId(orgId, clerkUserId),
    ]);

    if (!membership) throw new ForbiddenError();

    return {
      organization: org,
      recentDocs: org.documents,
      analyzedCount,
      membership,
    };
  }

  async getMemberByClerkUserId(
    orgId: string,
    clerkUserId: string,
  ): Promise<OrganizationMember> {
    const member = await this.repo.findMemberByClerkUserId(orgId, clerkUserId);
    if (!member) throw new ForbiddenError();
    return member;
  }

  async getMemberWithUserByClerkUserId(
    orgId: string,
    clerkUserId: string,
  ) {
    const member = await this.repo.findMemberByClerkUserIdWithUser(
      orgId,
      clerkUserId,
    );
    if (!member) throw new ForbiddenError();
    return member;
  }
}
