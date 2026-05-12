import "server-only";
import {
  NotFoundError,
  ForbiddenError,
} from "@/features/shared/errors";
import type { OrganizationsRepositoryPort } from "../domain/ports/organizations.repository.port";
import type { UserResolutionPort } from "../domain/ports/user-resolution.port";
import type { VoucherTypeSeedPort } from "../domain/ports/voucher-type-seed.port";
import type { AccountSeedPort } from "../domain/ports/account-seed.port";
import type { SystemRoleSeedPort } from "../domain/ports/system-role-seed.port";
import type { Organization, OrganizationMember } from "@/generated/prisma/client";
import type {
  CreateOrganizationInput,
  SyncOrganizationResult,
} from "../domain/types";

// -- Service deps (port injection) -----------------------------------------

export interface OrganizationsServiceDeps {
  repo: OrganizationsRepositoryPort;
  users: UserResolutionPort;
  voucherTypeSeed: VoucherTypeSeedPort;
  accountSeed: AccountSeedPort;
  systemRoleSeed: SystemRoleSeedPort;
}

export class OrganizationsService {
  private readonly repo: OrganizationsRepositoryPort;
  private readonly users: UserResolutionPort;
  private readonly voucherTypeSeed: VoucherTypeSeedPort;
  private readonly accountSeed: AccountSeedPort;
  private readonly systemRoleSeed: SystemRoleSeedPort;

  constructor(deps: OrganizationsServiceDeps) {
    this.repo = deps.repo;
    this.users = deps.users;
    this.voucherTypeSeed = deps.voucherTypeSeed;
    this.accountSeed = deps.accountSeed;
    this.systemRoleSeed = deps.systemRoleSeed;
  }

  // -----------------------------------------------------------------------
  // Sincronizar / crear organizacion (idempotente -- usado por el route handler)
  // -----------------------------------------------------------------------

  async syncOrganization(
    input: CreateOrganizationInput,
    clerkUserId: string,
  ): Promise<SyncOrganizationResult> {
    // Si la organizacion ya existe, retornarla sin modificar nada
    const existing = await this.repo.findByClerkId(input.clerkOrgId);
    if (existing) {
      return { organization: existing, created: false };
    }

    // Asegurar que el usuario que realiza la llamada exista en nuestra BD.
    // User es entidad shared cross-org (el user puede persistir aunque falle
    // la org), por eso queda fuera de la transaccion de inicializacion.
    const user = await this.users.findOrCreate({
      clerkUserId,
      email: `${clerkUserId}@temp.com`,
      name: "User",
    });

    // Inicializacion atomica: org + owner member + voucher types + plan de
    // cuentas + system roles. Si cualquiera falla, rollback completo -- no
    // quedan orgs huerfanas con seeds parciales que romperian la creacion de
    // comprobantes o asientos despues.
    const organization = await this.repo.transaction(async (tx) => {
      const org = await this.repo.create(input, tx);

      await this.repo.addMember(
        {
          userId: user.id,
          organizationId: org.id,
          role: "owner",
        },
        tx,
      );

      await this.voucherTypeSeed.seedDefaultsForOrg(org.id, tx);

      await this.accountSeed.seedChartOfAccounts(org.id, tx);

      const payloads = this.systemRoleSeed.buildSystemRolePayloads(org.id);
      await tx.customRole.createMany({
        data: payloads,
        skipDuplicates: true,
      });

      return org;
    });

    return { organization, created: true };
  }

  // -----------------------------------------------------------------------
  // Busquedas
  // -----------------------------------------------------------------------

  async getBySlug(slug: string) {
    const org = await this.repo.findBySlug(slug);
    if (!org) throw new NotFoundError("Organizacion");
    return org;
  }

  async getById(id: string) {
    const org = await this.repo.findById(id);
    if (!org) throw new NotFoundError("Organizacion");
    return org;
  }

  async getByClerkId(clerkOrgId: string) {
    const org = await this.repo.findByClerkId(clerkOrgId);
    if (!org) throw new NotFoundError("Organizacion");
    return org;
  }

  // -----------------------------------------------------------------------
  // Membresia
  // -----------------------------------------------------------------------

  async getOrgWithMembers(organizationId: string) {
    return this.repo.getMembers(organizationId);
  }

  async verifyMembership(
    clerkUserId: string,
    orgSlug: string,
  ): Promise<string> {
    const org = await this.repo.findBySlug(orgSlug);
    if (!org) throw new NotFoundError("Organizacion");

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
    if (!organization) throw new NotFoundError("Organizacion");

    const membership = await this.repo.findMemberByClerkUserId(
      organization.id,
      clerkUserId,
    );
    if (!membership) throw new ForbiddenError();

    return { organization, membership };
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
