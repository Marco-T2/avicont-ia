import { auth } from "@clerk/nextjs/server";
import { ZodError } from "zod";
import {
  AppError,
  UnauthorizedError,
} from "./errors";
import { OrganizationsService } from "@/features/organizations/organizations.service";

const orgsService = new OrganizationsService();

export async function requireAuth() {
  const session = await auth();
  if (!session.userId) throw new UnauthorizedError();
  return session;
}

export async function requireOrgAccess(
  clerkUserId: string,
  orgSlug: string,
): Promise<string> {
  return orgsService.verifyMembership(clerkUserId, orgSlug);
}

export async function requireRole(
  clerkUserId: string,
  orgId: string,
  roles: string[],
) {
  return orgsService.requireMemberWithRoles(orgId, clerkUserId, roles);
}

export function handleError(error: unknown): Response {
  if (error instanceof ZodError) {
    return Response.json(
      { error: "Datos inválidos", details: error.flatten() },
      { status: 400 },
    );
  }
  if (error instanceof AppError) {
    return Response.json(
      { error: error.message, code: error.code },
      { status: error.statusCode },
    );
  }
  console.error("Unhandled error:", error);
  return Response.json(
    { error: "Error interno del servidor" },
    { status: 500 },
  );
}
