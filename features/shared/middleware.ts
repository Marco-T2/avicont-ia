import { auth } from "@clerk/nextjs/server";
import { ZodError } from "zod";
import {
  AppError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
} from "./errors";
import { OrganizationsRepository } from "@/features/organizations/organizations.repository";

const orgRepo = new OrganizationsRepository();

export async function requireAuth() {
  const session = await auth();
  if (!session.userId) throw new UnauthorizedError();
  return session;
}

export async function requireOrgAccess(
  clerkUserId: string,
  orgSlug: string,
): Promise<string> {
  const org = await orgRepo.findBySlug(orgSlug);
  if (!org) throw new NotFoundError("Organización");

  const member = await orgRepo.findMemberByClerkUserId(org.id, clerkUserId);
  if (!member) throw new ForbiddenError();

  return org.id;
}

export async function requireRole(
  clerkUserId: string,
  orgId: string,
  roles: string[],
) {
  const member = await orgRepo.findMemberByClerkUserIdAndRoles(
    orgId,
    clerkUserId,
    roles,
  );
  if (!member) throw new ForbiddenError();
  return member;
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
