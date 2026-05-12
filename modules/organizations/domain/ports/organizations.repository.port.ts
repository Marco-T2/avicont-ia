import type { Organization, OrganizationMember, Prisma } from "@/generated/prisma/client";
import type {
  AddMemberInput,
  CreateOrganizationInput,
  OrganizationWithMembers,
} from "../types";

/**
 * Read/write port for the Organization + OrganizationMember aggregates.
 *
 * Mirror: modules/dispatch/domain/ports/dispatch.repository.ts pattern.
 */
export interface OrganizationsRepositoryPort {
  // -- Organization lookups (no org-scoping) --
  findById(id: string): Promise<Organization | null>;
  findBySlug(slug: string): Promise<Organization | null>;
  findByClerkId(clerkOrgId: string): Promise<Organization | null>;

  // -- Organization mutations --
  create(
    data: CreateOrganizationInput,
    tx?: Prisma.TransactionClient,
  ): Promise<Organization>;

  // -- Member queries (org-scoped) --
  getMembers(organizationId: string): Promise<OrganizationWithMembers>;

  findMember(
    organizationId: string,
    userId: string,
  ): Promise<OrganizationMember | null>;

  findMemberByClerkUserId(
    organizationId: string,
    clerkUserId: string,
  ): Promise<OrganizationMember | null>;

  findMemberByClerkUserIdWithUser(
    organizationId: string,
    clerkUserId: string,
  ): Promise<(OrganizationMember & { user: { id: string } }) | null>;

  findMemberByClerkUserIdAndRoles(
    organizationId: string,
    clerkUserId: string,
    roles: string[],
  ): Promise<OrganizationMember | null>;

  // -- Member mutations --
  addMember(
    data: AddMemberInput,
    tx?: Prisma.TransactionClient,
  ): Promise<OrganizationMember>;

  findMemberById(
    organizationId: string,
    memberId: string,
  ): Promise<(OrganizationMember & { user: { clerkUserId: string; name: string | null; email: string } }) | null>;

  findMemberByEmail(
    organizationId: string,
    email: string,
    includeDeactivated?: boolean,
  ): Promise<(OrganizationMember & { user: { clerkUserId: string; name: string | null; email: string } }) | null>;

  updateMemberRole(
    organizationId: string,
    memberId: string,
    role: string,
  ): Promise<OrganizationMember>;

  deactivateMember(
    organizationId: string,
    memberId: string,
  ): Promise<OrganizationMember>;

  reactivateMember(
    organizationId: string,
    memberId: string,
    role: string,
    tx?: Prisma.TransactionClient,
  ): Promise<OrganizationMember>;

  hardDelete(
    organizationId: string,
    memberId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<{ count: number }>;

  // -- Transaction support --
  transaction<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
    options?: {
      maxWait?: number;
      timeout?: number;
      isolationLevel?: Prisma.TransactionIsolationLevel;
    },
  ): Promise<T>;
}
