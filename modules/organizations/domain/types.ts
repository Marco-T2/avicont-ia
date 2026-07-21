// ---------------------------------------------------------------------------
// Entidades de dominio (D4: domain-owned types)
//
// Espejo estructural de los scalars de los modelos Prisma (sin relaciones).
// Un row de `prisma.*.find*()` con select por defecto es asignable a estas
// interfaces sin cast; `tsc` verifica esa asignabilidad en los repositorios
// de infraestructura porque los puertos declaran ESTOS tipos como retorno.
// ---------------------------------------------------------------------------

export interface Organization {
  id: string;
  clerkOrgId: string;
  name: string;
  slug: string;
  createdAt: Date;
}

export interface OrganizationMember {
  id: string;
  organizationId: string;
  userId: string;
  role: string;
  deactivatedAt: Date | null;
}

export interface User {
  id: string;
  clerkUserId: string;
  email: string;
  name: string | null;
  createdAt: Date;
}

export interface CustomRole {
  id: string;
  organizationId: string;
  slug: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissionsRead: string[];
  permissionsWrite: string[];
  canPost: string[];
  createdAt: Date;
  updatedAt: Date;
}

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
