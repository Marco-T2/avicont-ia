/**
 * Outbound port for Clerk authentication operations.
 * Wraps `@clerk/nextjs/server` clerkClient for member-clerk-saga
 * and MembersService user resolution.
 */
export interface ClerkUserInfo {
  id: string;
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
}
