/**
 * Outbound port for Clerk authentication operations.
 * Wraps `@clerk/nextjs/server` clerkClient for member-clerk-saga,
 * MembersService user resolution, and lazy sync (EnsureFromClerkService).
 */
export interface ClerkUserInfo {
  id: string;
  firstName: string | null;
  lastName: string | null;
}

export interface ClerkOrganizationInfo {
  id: string;
  name: string;
  slug: string | null;
}

export interface ClerkMembershipInfo {
  role: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

export interface ClerkAuthPort {
  /** Search Clerk users by email address. */
  getUsersByEmail(email: string): Promise<ClerkUserInfo[]>;

  /** Create an organization membership in Clerk. */
  createOrganizationMembership(
    clerkOrgId: string,
    clerkUserId: string,
    role: string,
  ): Promise<void>;

  /** Delete an organization membership in Clerk. */
  deleteOrganizationMembership(
    clerkOrgId: string,
    clerkUserId: string,
  ): Promise<void>;

  /** Lookup an organization in Clerk by its id. Returns null when not found. */
  getOrganization(clerkOrgId: string): Promise<ClerkOrganizationInfo | null>;

  /** Find a specific user's membership in an org, returning role + identity
   *  data, or null if that user is not a member of that org in Clerk. */
  findMembership(
    clerkOrgId: string,
    clerkUserId: string,
  ): Promise<ClerkMembershipInfo | null>;
}
