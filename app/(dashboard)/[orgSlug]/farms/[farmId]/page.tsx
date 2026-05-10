import { redirect } from "next/navigation";
import { requireAuth } from "@/features/shared";
import { requireOrgAccess } from "@/features/organizations/server";
import { makeFarmService } from "@/modules/farm/presentation/server";
import { makeLotService } from "@/modules/lot/presentation/server";
import FarmDetailClient from "./farm-detail-client";

interface FarmDetailPageProps {
  params: Promise<{ orgSlug: string; farmId: string }>;
}

export default async function FarmDetailPage({ params }: FarmDetailPageProps) {
  const { orgSlug, farmId } = await params;

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

  const farmsService = makeFarmService();
  let farmEntity;
  try {
    farmEntity = await farmsService.getById(orgId, farmId);
  } catch {
    redirect(`/${orgSlug}/farms`);
  }
  const farm = farmEntity.toSnapshot();

  const lotsService = makeLotService();
  const lotEntities = await lotsService.listByFarm(orgId, farmId);
  const lots = lotEntities.map((l) => l.toSnapshot());

  return (
    <FarmDetailClient
      orgSlug={orgSlug}
      farm={farm}
      lots={lots}
    />
  );
}
