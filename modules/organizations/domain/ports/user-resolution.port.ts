/**
 * Outbound port for user identity resolution.
 * Wraps features/users UsersService for org + member lifecycle.
 */
export interface ResolvedUser {
  id: string;
  clerkUserId: string;
  email: string;
  name: string | null;
}

export interface UserResolutionPort {
  /** Find a user by email. Returns null if not found. */
  findByEmail(email: string): Promise<ResolvedUser | null>;

  /** Find or create a user by Clerk ID (used in syncOrganization). */
  findOrCreate(data: {
    clerkUserId: string;
    email: string;
    name: string;
  }): Promise<ResolvedUser>;

  /** Create a new user record. */
  create(data: {
    clerkUserId: string;
    email: string;
    name: string;
  }): Promise<ResolvedUser>;
}
