import { redirect } from "next/navigation";
import { requireAuth, requireOrgAccess } from "@/features/shared";
import { FarmsService } from "@/features/farms";
import { LotsService } from "@/features/lots";
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

  const farmsService = new FarmsService();
  let farm;
  try {
    farm = await farmsService.getById(orgId, farmId);
  } catch {
    redirect(`/${orgSlug}/farms`);
  }

  const lotsService = new LotsService();
  const lots = await lotsService.listByFarm(orgId, farmId);

  return (
    <FarmDetailClient
      orgSlug={orgSlug}
      farm={farm}
      lots={lots}
    />
  );
}
