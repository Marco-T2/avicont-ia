import { clerkClient } from "@clerk/nextjs/server";
import {
  NotFoundError,
  ConflictError,
  ForbiddenError,
  ValidationError,
} from "@/features/shared/errors";
import { OrganizationsRepository } from "./organizations.repository";
import { UsersService } from "@/features/shared/users.service";

function isClerkDuplicateError(error: unknown): boolean {
  if (error === null || typeof error !== 'object' || !('errors' in error)) return false;
  const clerkError = error as { errors?: Array<{ code?: string }> };
  return clerkError.errors?.[0]?.code?.includes('duplicate') ?? false;
}

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
    // Find or sync the user from Clerk
    const existingUser = await this.usersService.findByEmail(email);

    let user;
    if (existingUser) {
      user = existingUser;
    } else {
      // Not in local DB — search in Clerk and sync
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

    // Check if already a member (including deactivated)
    const existing = await this.repo.findMemberByEmail(
      organizationId,
      email,
      true,
    );

    if (existing) {
      if (existing.deactivatedAt === null) {
        // Active member — conflict
        throw new ConflictError(
          "El usuario ya es miembro de esta organización",
        );
      }

      // Deactivated member — reactivate
      // Re-add to Clerk organization FIRST
      const org = await this.repo.findById(organizationId);
      if (!org) throw new NotFoundError("Organización");

      try {
        const client = await clerkClient();
        await client.organizations.createOrganizationMembership({
          organizationId: org.clerkOrgId,
          userId: user.clerkUserId,
          role: "org:member",
        });
      } catch (error: unknown) {
        if (!isClerkDuplicateError(error)) {
          console.error("Error re-adding member to Clerk org:", error);
          throw error; // Abort reactivation if Clerk fails
        }
      }

      // Reactivate in local DB
      const reactivated = await this.repo.reactivateMember(existing.id, role);

      return {
        id: reactivated.id,
        role: reactivated.role,
        userId: reactivated.userId,
        name: existing.user.name ?? existing.user.email,
        email: existing.user.email,
      };
    }

    // No existing member — continue with normal add flow
    const org = await this.repo.findById(organizationId);
    if (!org) throw new NotFoundError("Organización");

    try {
      const client = await clerkClient();
      await client.organizations.createOrganizationMembership({
        organizationId: org.clerkOrgId,
        userId: user.clerkUserId,
        role: "org:member",
      });
    } catch (error: unknown) {
      // If already a member in Clerk, ignore the error
      if (!isClerkDuplicateError(error)) {
        console.error("Error adding member to Clerk org:", error);
      }
    }

    const member = await this.repo.addMember({
      organizationId,
      userId: user.id,
      role,
    });

    return {
      id: member.id,
      role: member.role,
      userId: member.userId,
      name: user.name ?? user.email,
      email: user.email,
    };
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

    // Check caller is not changing their own role
    if (member.user.clerkUserId === currentClerkUserId) {
      throw new ValidationError("No podés cambiar tu propio rol");
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
      throw new ValidationError("No podés desactivarte a vos mismo");
    }

    // Remove from Clerk organization
    const org = await this.repo.findById(organizationId);
    if (!org) throw new NotFoundError("Organización");

    try {
      const client = await clerkClient();
      await client.organizations.deleteOrganizationMembership({
        organizationId: org.clerkOrgId,
        userId: member.user.clerkUserId,
      });
    } catch (error: unknown) {
      // If not found in Clerk, ignore (already removed or never added)
      console.error("Error removing member from Clerk org:", error);
    }

    await this.repo.deactivateMember(organizationId, memberId);
  }
}
