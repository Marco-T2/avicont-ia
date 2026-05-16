import "server-only";
import { clerkClient } from "@clerk/nextjs/server";
import type {
  ClerkAuthPort,
  ClerkMembershipInfo,
  ClerkOrganizationInfo,
  ClerkUserInfo,
} from "../../domain/ports/clerk-auth.port";

/**
 * Legacy adapter: wraps @clerk/nextjs/server clerkClient for member-clerk-saga,
 * MembersService user resolution, and lazy sync.
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

  async getOrganization(
    clerkOrgId: string,
  ): Promise<ClerkOrganizationInfo | null> {
    const client = await clerkClient();
    try {
      const org = await client.organizations.getOrganization({
        organizationId: clerkOrgId,
      });
      return { id: org.id, name: org.name, slug: org.slug };
    } catch {
      // Clerk 404 → port contract: return null
      return null;
    }
  }

  async findMembership(
    clerkOrgId: string,
    clerkUserId: string,
  ): Promise<ClerkMembershipInfo | null> {
    const client = await clerkClient();
    const list = await client.organizations.getOrganizationMembershipList({
      organizationId: clerkOrgId,
    });
    const m = list.data.find(
      (x) => x.publicUserData?.userId === clerkUserId,
    );
    if (!m || !m.publicUserData) return null;
    return {
      role: m.role,
      email: m.publicUserData.identifier ?? "",
      firstName: m.publicUserData.firstName ?? null,
      lastName: m.publicUserData.lastName ?? null,
    };
  }
}
