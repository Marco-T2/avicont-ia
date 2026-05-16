import { redirect } from "next/navigation";
import { requireAuth } from "@/features/shared";
import { requireOrgAccess } from "@/modules/organizations/presentation/server";
import { canAccess } from "@/features/permissions/server";
import { makeOrganizationsService } from "@/modules/organizations/presentation/server";
import { makeFarmService, attachLots } from "@/modules/farm/presentation/server";
import FarmsPageClient from "./farms-client";

const orgService = makeOrganizationsService();

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

  const farmsService = makeFarmService();
  const canManageFarms = await canAccess(member.role, "members", "write", orgId);
  const farmEntities = canManageFarms
    ? await farmsService.list(orgId)
    : await farmsService.list(orgId, { memberId: member.id });
  const farms = await attachLots(orgId, farmEntities);

  return (
    <div className="space-y-6">
      <FarmsPageClient orgSlug={orgSlug} memberId={member.id} farms={farms} />
    </div>
  );
}
