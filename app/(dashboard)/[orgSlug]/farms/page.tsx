import { redirect } from "next/navigation";
import { requireAuth, requireOrgAccess } from "@/features/shared";
import { canAccess } from "@/features/shared/permissions.server";
import { OrganizationsService } from "@/features/organizations";
import { FarmsService } from "@/features/farms/server";
import FarmsPageClient from "./farms-client";

const orgService = new OrganizationsService();

interface FarmsPageProps {
  params: Promise<{ orgSlug: string }>;
}

export default async function FarmsPage({ params }: FarmsPageProps) {
  const { orgSlug } = await params;

  // RBAC-EXCEPTION: Cross-module auth-only; no farms resource in frozen Resource union. Decision: rbac-legacy-auth-chain-migration 2026-04-19.
  let userId: string;
  try {
    const session = await requireAuth();
    userId = session.userId;
  } catch {
    redirect("/sign-in");
  }

  let orgId: string;
  try {
    orgId = await requireOrgAccess(userId, orgSlug);
  } catch {
    redirect("/select-org");
  }

  let member;
  try {
    member = await orgService.getMemberByClerkUserId(orgId, userId);
  } catch {
    redirect("/select-org");
  }

  const farmsService = new FarmsService();
  const canManageFarms = await canAccess(member.role, "members", "write", orgId);
  const farms = canManageFarms
    ? await farmsService.list(orgId)
    : await farmsService.listByMember(orgId, member.id);

  return (
    <div className="space-y-8">
      <FarmsPageClient orgSlug={orgSlug} memberId={member.id} farms={farms} />
    </div>
  );
}
