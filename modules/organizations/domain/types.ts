import type {
  Organization,
  OrganizationMember,
  User,
} from "@/generated/prisma/client";

// ---------------------------------------------------------------------------
// DTOs de entrada
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
// Helpers de consulta
// ---------------------------------------------------------------------------

export interface OrganizationWithMembers extends Organization {
  members: (OrganizationMember & { user: User })[];
}

// ---------------------------------------------------------------------------
// Tipos de retorno del servicio
// ---------------------------------------------------------------------------

export interface SyncOrganizationResult {
  organization: Organization;
  created: boolean;
}
