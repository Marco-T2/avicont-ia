import "server-only";
import { clerkClient } from "@clerk/nextjs/server";
import type { ClerkAuthPort, ClerkUserInfo } from "../../domain/ports/clerk-auth.port";

/**
 * Legacy adapter: wraps @clerk/nextjs/server clerkClient for member-clerk-saga
 * and MembersService user resolution.
 */
export class LegacyClerkAuthAdapter implements ClerkAuthPort {
  async getUsersByEmail(email: string): Promise<ClerkUserInfo[]> {
    const client = await clerkClient();
    const clerkUsers = await client.users.getUserList({
      emailAddress: [email],
    });
    return clerkUsers.data.map((u) => ({
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
    }));
  }

  async createOrganizationMembership(
    clerkOrgId: string,
    clerkUserId: string,
    role: string,
  ): Promise<void> {
    const client = await clerkClient();
    await client.organizations.createOrganizationMembership({
      organizationId: clerkOrgId,
      userId: clerkUserId,
      role,
    });
  }

  async deleteOrganizationMembership(
    clerkOrgId: string,
    clerkUserId: string,
  ): Promise<void> {
    const client = await clerkClient();
    await client.organizations.deleteOrganizationMembership({
      organizationId: clerkOrgId,
      userId: clerkUserId,
    });
  }
}
