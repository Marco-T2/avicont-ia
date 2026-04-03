import type {
  Organization,
  OrganizationMember,
  User,
} from "@/generated/prisma/client";

// ---------------------------------------------------------------------------
// Input DTOs
// ---------------------------------------------------------------------------

export interface CreateOrganizationInput {
  clerkOrgId: string;
  name: string;
  slug?: string;
}

export interface AddMemberInput {
  userId: string;
  organizationId: string;
  role?: string;
}

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

export interface OrganizationWithMembers extends Organization {
  members: (OrganizationMember & { user: User })[];
}

// ---------------------------------------------------------------------------
// Service return types
// ---------------------------------------------------------------------------

export interface SyncOrganizationResult {
  organization: Organization;
  created: boolean;
}
