import type {
  AddMemberInput,
  CreateOrganizationInput,
  Organization,
  OrganizationMember,
  OrganizationWithMembers,
} from "../types";

/**
 * Read/write port for the Organization + OrganizationMember aggregates.
 *
 * Mirror: modules/dispatch/domain/ports/dispatch.repository.ts pattern.
 *
 * tx pattern: opaque token (`tx?: unknown`) — no Prisma leakage into the
 * port surface. Mirror: accounts-crud.port.ts / voucher-types.service.ts.
 * The infra adapter (prisma-organizations.repository.ts) casts back
 * internally: `const client = (tx ?? this.db) as Prisma.TransactionClient;`
 *
 * `transaction()`'s callback param is opaque too, for the same reason. Its
 * `options.isolationLevel` was DROPPED from this domain surface rather than
 * mirrored, because mirroring `Prisma.TransactionIsolationLevel` as a
 * domain-owned string union here would be scope-creep no caller currently
 * needs (no call site passes `isolationLevel` today — see
 * organizations.service.ts's single `repo.transaction(async (tx) => ...)`
 * call, no options object at all). The infra implementation
 * (BaseRepository.transaction) keeps its own Prisma-typed `isolationLevel`
 * internally and is free to widen it again later without touching this port.
 */
export interface OrganizationsRepositoryPort {
  // -- Organization lookups (no org-scoping) --
  findById(id: string): Promise<Organization | null>;
  findBySlug(slug: string): Promise<Organization | null>;
  findByClerkId(clerkOrgId: string): Promise<Organization | null>;

  // -- Organization mutations --
  create(
    data: CreateOrganizationInput,
    tx?: unknown,
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
    tx?: unknown,
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
    tx?: unknown,
  ): Promise<OrganizationMember>;

  hardDelete(
    organizationId: string,
    memberId: string,
    tx?: unknown,
  ): Promise<{ count: number }>;

  // -- Transaction support --
  transaction<T>(
    fn: (tx: unknown) => Promise<T>,
    options?: {
      maxWait?: number;
      timeout?: number;
    },
  ): Promise<T>;
}
