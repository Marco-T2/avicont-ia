import {
  NotFoundError,
  ForbiddenError,
} from "@/features/shared/errors";
import { OrganizationsRepository } from "./organizations.repository";
import { UsersService } from "@/features/shared/users.service";
import { VoucherTypesService } from "@/features/voucher-types";
import { prisma } from "@/lib/prisma";
import { buildSystemRolePayloads } from "@/prisma/seed-system-roles";
import type { Organization, OrganizationMember } from "@/generated/prisma/client";
import type {
  CreateOrganizationInput,
  SyncOrganizationResult,
} from "./organizations.types";

export class OrganizationsService {
  private readonly voucherTypesService: VoucherTypesService;
  private readonly usersService: UsersService;

  constructor(
    private readonly repo: OrganizationsRepository = new OrganizationsRepository(),
    voucherTypesService?: VoucherTypesService,
    usersService?: UsersService,
  ) {
    this.voucherTypesService = voucherTypesService ?? new VoucherTypesService();
    this.usersService = usersService ?? new UsersService();
  }

  // -----------------------------------------------------------------------
  // Sincronizar / crear organización (idempotente — usado por el route handler)
  // -----------------------------------------------------------------------

  async syncOrganization(
    input: CreateOrganizationInput,
    clerkUserId: string,
  ): Promise<SyncOrganizationResult> {
    // Si la organización ya existe, retornarla sin modificar nada
    const existing = await this.repo.findByClerkId(input.clerkOrgId);
    if (existing) {
      return { organization: existing, created: false };
    }

    // Asegurar que el usuario que realiza la llamada exista en nuestra BD
    const user = await this.usersService.findOrCreate({
      clerkUserId,
      email: `${clerkUserId}@temp.com`,
      name: "User",
    });

    // Crear la organización
    const organization = await this.repo.create(input);

    // Agregar al creador como propietario
    await this.repo.addMember({
      userId: user.id,
      organizationId: organization.id,
      role: "owner",
    });

    // Inicializar los tipos de comprobante por defecto para la nueva organización
    await this.voucherTypesService.seedForOrg(organization.id);

    // Seed the 5 system roles for the new organization (idempotent via skipDuplicates)
    // This is preventive: on-demand fallback in permissions.server.ts handles the
    // last-resort case. Both use skipDuplicates so they cannot conflict.
    await prisma.customRole.createMany({
      data: buildSystemRolePayloads(organization.id),
      skipDuplicates: true,
    });

    return { organization, created: true };
  }

  // -----------------------------------------------------------------------
  // Búsquedas
  // -----------------------------------------------------------------------

  async getBySlug(slug: string) {
    const org = await this.repo.findBySlug(slug);
    if (!org) throw new NotFoundError("Organización");
    return org;
  }

  async getById(id: string) {
    const org = await this.repo.findById(id);
    if (!org) throw new NotFoundError("Organización");
    return org;
  }

  async getByClerkId(clerkOrgId: string) {
    const org = await this.repo.findByClerkId(clerkOrgId);
    if (!org) throw new NotFoundError("Organización");
    return org;
  }

  // -----------------------------------------------------------------------
  // Membresía
  // -----------------------------------------------------------------------

  async getOrgWithMembers(organizationId: string) {
    return this.repo.getMembers(organizationId);
  }

  async verifyMembership(
    clerkUserId: string,
    orgSlug: string,
  ): Promise<string> {
    const org = await this.repo.findBySlug(orgSlug);
    if (!org) throw new NotFoundError("Organización");

    const member = await this.repo.findMemberByClerkUserId(
      org.id,
      clerkUserId,
    );
    if (!member) throw new ForbiddenError();

    return org.id;
  }

  // -----------------------------------------------------------------------
  // Datos de layout y dashboard
  // -----------------------------------------------------------------------

  async getOrgLayoutData(
    slug: string,
    clerkUserId: string,
  ): Promise<{ organization: Organization; membership: OrganizationMember }> {
    const organization = await this.repo.findBySlug(slug);
    if (!organization) throw new NotFoundError("Organización");

    const membership = await this.repo.findMemberByClerkUserId(
      organization.id,
      clerkUserId,
    );
    if (!membership) throw new ForbiddenError();

    return { organization, membership };
  }

  async getDashboardData(orgId: string, clerkUserId: string) {
    const [{ org, analyzedCount }, membership] = await Promise.all([
      this.repo.getOrgWithDocStats(orgId),
      this.repo.findMemberByClerkUserId(orgId, clerkUserId),
    ]);

    if (!membership) throw new ForbiddenError();

    return {
      organization: org,
      recentDocs: org.documents,
      analyzedCount,
      membership,
    };
  }

  async getMemberByClerkUserId(
    orgId: string,
    clerkUserId: string,
  ): Promise<OrganizationMember> {
    const member = await this.repo.findMemberByClerkUserId(orgId, clerkUserId);
    if (!member) throw new ForbiddenError();
    return member;
  }

  async getMemberWithUserByClerkUserId(
    orgId: string,
    clerkUserId: string,
  ) {
    const member = await this.repo.findMemberByClerkUserIdWithUser(
      orgId,
      clerkUserId,
    );
    if (!member) throw new ForbiddenError();
    return member;
  }

  async getMemberById(
    organizationId: string,
    memberId: string,
  ): Promise<OrganizationMember | null> {
    return this.repo.findMemberById(organizationId, memberId);
  }

  async requireMemberWithRoles(
    orgId: string,
    clerkUserId: string,
    roles: string[],
  ): Promise<OrganizationMember> {
    const member = await this.repo.findMemberByClerkUserIdAndRoles(
      orgId,
      clerkUserId,
      roles,
    );
    if (!member) throw new ForbiddenError();
    return member;
  }
}
