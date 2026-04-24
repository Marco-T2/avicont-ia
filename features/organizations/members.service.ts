import "server-only";
import { clerkClient } from "@clerk/nextjs/server";
import {
  NotFoundError,
  ConflictError,
  ForbiddenError,
  ValidationError,
  CANNOT_CHANGE_OWN_ROLE,
} from "@/features/shared/errors";
import { OrganizationsRepository } from "./organizations.repository";
import { UsersService } from "@/features/shared/users.service";
import { runMemberClerkSaga } from "./member-clerk-saga";
import {
  isClerkDuplicateMembershipError,
  isClerkMembershipNotFoundError,
} from "./clerk-error-classifiers";

export class MembersService {
  private readonly usersService: UsersService;

  constructor(
    private readonly repo: OrganizationsRepository = new OrganizationsRepository(),
    usersService?: UsersService,
  ) {
    this.usersService = usersService ?? new UsersService();
  }

  async listMembers(organizationId: string) {
    const org = await this.repo.getMembers(organizationId);
    return org.members.map((m) => ({
      id: m.id,
      role: m.role,
      userId: m.userId,
      name: m.user.name ?? m.user.email,
      email: m.user.email,
    }));
  }

  async addMember(organizationId: string, email: string, role: string) {
    // Buscar o sincronizar el usuario desde Clerk
    const existingUser = await this.usersService.findByEmail(email);

    let user;
    if (existingUser) {
      user = existingUser;
    } else {
      // No existe en BD local — buscar en Clerk y sincronizar
      const client = await clerkClient();
      const clerkUsers = await client.users.getUserList({
        emailAddress: [email],
      });

      if (clerkUsers.data.length === 0) {
        throw new NotFoundError(
          "El usuario no está registrado en el sistema",
        );
      }

      const clerkUser = clerkUsers.data[0];
      const name = `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim();

      user = await this.usersService.create({
        clerkUserId: clerkUser.id,
        email,
        name: name || "Usuario",
      });
    }

    // Verificar si ya es miembro (incluyendo desactivados)
    const existing = await this.repo.findMemberByEmail(
      organizationId,
      email,
      true,
    );

    if (existing) {
      if (existing.deactivatedAt === null) {
        // Miembro activo — conflicto
        throw new ConflictError(
          "El usuario ya es miembro de esta organización",
        );
      }

      // Miembro desactivado — reactivar.
      //
      // REQ-MCS.2: DB-first saga with compensation. Reactivation flips
      // deactivatedAt: null AND overwrites role. On Clerk failure the
      // compensation re-sets `deactivatedAt` via deactivateMember,
      // restoring the soft-deleted state. On Clerk duplicate (user
      // already in the Clerk org) the saga short-circuits as idempotent
      // success.
      const reactivateOrg = await this.repo.findById(organizationId);
      if (!reactivateOrg) throw new NotFoundError("Organización");

      const reactivateCorrelationId = crypto.randomUUID();

      const reactivatedDto = await runMemberClerkSaga<{
        id: string;
        role: string;
        userId: string;
        name: string;
        email: string;
      }>({
        ctx: {
          operation: "reactivate",
          organizationId,
          memberId: existing.id, // pre-known
          clerkUserId: user.clerkUserId,
          correlationId: reactivateCorrelationId,
        },
        dbWrite: async () => {
          const reactivated = await this.repo.reactivateMember(
            organizationId,
            existing.id,
            role,
          );
          return {
            memberId: existing.id,
            result: {
              id: reactivated.id,
              role: reactivated.role,
              userId: reactivated.userId,
              name: existing.user.name ?? existing.user.email,
              email: existing.user.email,
            },
          };
        },
        clerkCall: async () => {
          const client = await clerkClient();
          await client.organizations.createOrganizationMembership({
            organizationId: reactivateOrg.clerkOrgId,
            userId: user.clerkUserId,
            role: "org:member",
          });
        },
        compensate: async () => {
          // Re-set deactivatedAt (role left as-is; restoring to
          // soft-deleted state is the only requirement per REQ-MCS.2-3).
          await this.repo.deactivateMember(organizationId, existing.id);
        },
        isIdempotentSuccess: isClerkDuplicateMembershipError,
        divergentState: {
          dbState: "member_active",
          clerkState: "membership_absent",
        },
      });

      return reactivatedDto;
    }

    // No existe miembro previo — continuar con el flujo normal de alta.
    //
    // REQ-MCS.1: DB-first saga with compensation. The old Clerk-first +
    // swallow block (I-6 / REQ-MCS.6) is eliminated here in favour of
    // runMemberClerkSaga. Non-duplicate Clerk errors now surface as 503
    // and trigger hardDelete compensation — no silent inconsistency.
    const org = await this.repo.findById(organizationId);
    if (!org) throw new NotFoundError("Organización");

    const correlationId = crypto.randomUUID();
    // Captured by dbWrite for the compensate closure to read. Plain local
    // variable — `runMemberClerkSaga` executes dbWrite BEFORE compensate,
    // so this is guaranteed set when compensate runs.
    let insertedMemberId = "";

    const memberDto = await runMemberClerkSaga<{
      id: string;
      role: string;
      userId: string;
      name: string;
      email: string;
    }>({
      ctx: {
        operation: "add",
        organizationId,
        memberId: "", // filled by dbWrite return value (threaded via saga ctx)
        clerkUserId: user.clerkUserId,
        correlationId,
      },
      dbWrite: async () => {
        const member = await this.repo.addMember({
          organizationId,
          userId: user.id,
          role,
        });
        insertedMemberId = member.id;
        return {
          memberId: member.id,
          result: {
            id: member.id,
            role: member.role,
            userId: member.userId,
            name: user.name ?? user.email,
            email: user.email,
          },
        };
      },
      clerkCall: async () => {
        const client = await clerkClient();
        await client.organizations.createOrganizationMembership({
          organizationId: org.clerkOrgId,
          userId: user.clerkUserId,
          role: "org:member",
        });
      },
      compensate: async () => {
        // hardDelete is idempotent (deleteMany); safe if the row is gone.
        await this.repo.hardDelete(organizationId, insertedMemberId);
      },
      isIdempotentSuccess: isClerkDuplicateMembershipError,
      divergentState: {
        dbState: "member_inserted",
        clerkState: "membership_absent",
      },
    });

    return memberDto;
  }

  async updateRole(
    organizationId: string,
    memberId: string,
    role: string,
    currentClerkUserId: string,
  ) {
    const member = await this.repo.findMemberById(organizationId, memberId);
    if (!member) throw new NotFoundError("Miembro");

    if (member.role === "owner") {
      throw new ValidationError("No se puede cambiar el rol del propietario");
    }

    // Verificar que el invocador no esté cambiando su propio rol (D.4)
    if (member.user.clerkUserId === currentClerkUserId) {
      throw new ForbiddenError(
        "No podés cambiar tu propio rol",
        CANNOT_CHANGE_OWN_ROLE,
      );
    }

    const updated = await this.repo.updateMemberRole(
      organizationId,
      memberId,
      role,
    );
    return {
      id: updated.id,
      role: updated.role,
      userId: updated.userId,
      name: member.user.name ?? member.user.email,
      email: member.user.email,
    };
  }

  async removeMember(
    organizationId: string,
    memberId: string,
    currentClerkUserId: string,
  ) {
    const member = await this.repo.findMemberById(organizationId, memberId);
    if (!member) throw new NotFoundError("Miembro");

    if (member.role === "owner") {
      throw new ValidationError("No se puede desactivar al propietario");
    }

    if (member.user.clerkUserId === currentClerkUserId) {
      throw new ForbiddenError(
        "No podés desactivarte a vos mismo",
        CANNOT_CHANGE_OWN_ROLE,
      );
    }

    const org = await this.repo.findById(organizationId);
    if (!org) throw new NotFoundError("Organización");

    // REQ-MCS.3: DB-first saga with compensation for removal.
    //
    //   - dbWrite: repo.deactivateMember (soft-delete).
    //   - clerkCall: clerkClient.organizations.deleteOrganizationMembership.
    //   - compensate: repo.reactivateMember(org, memberId, previousRole)
    //     restores the exact active-state row (role retained).
    //   - isIdempotentSuccess: isClerkMembershipNotFoundError — a Clerk
    //     404 means the membership is already absent on their side;
    //     treat as success (per REQ-MCS.3-5). The old "Si no se encuentra
    //     en Clerk, ignorar" swallow is replaced by this explicit
    //     classifier.
    //
    // `previousRole` is captured from findMemberById BEFORE deactivation
    // (per design §1, §11) — the soft-deleted row would be fine to
    // re-read, but capturing up-front is simpler and avoids a second
    // repo roundtrip during compensation.
    const previousRole = member.role;
    const removeCorrelationId = crypto.randomUUID();

    await runMemberClerkSaga<void>({
      ctx: {
        operation: "remove",
        organizationId,
        memberId,
        clerkUserId: member.user.clerkUserId,
        correlationId: removeCorrelationId,
      },
      dbWrite: async () => {
        await this.repo.deactivateMember(organizationId, memberId);
        return { memberId, result: undefined };
      },
      clerkCall: async () => {
        const client = await clerkClient();
        await client.organizations.deleteOrganizationMembership({
          organizationId: org.clerkOrgId,
          userId: member.user.clerkUserId,
        });
      },
      compensate: async () => {
        await this.repo.reactivateMember(
          organizationId,
          memberId,
          previousRole,
        );
      },
      isIdempotentSuccess: isClerkMembershipNotFoundError,
      divergentState: {
        dbState: "member_deactivated",
        clerkState: "membership_present",
      },
    });
  }
}
