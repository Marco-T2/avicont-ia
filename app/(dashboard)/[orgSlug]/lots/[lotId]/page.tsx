import { redirect } from "next/navigation";
import { requireAuth } from "@/features/shared";
import { requireOrgAccess } from "@/modules/organizations/presentation/server";
import { makeLotService } from "@/modules/lot/presentation/server";
import { makeExpenseService } from "@/modules/expense/presentation/server";
import { makeMortalityService } from "@/modules/mortality/presentation/server";
import LotDetailClient from "./lot-detail-client";

interface LotDetailPageProps {
  params: Promise<{ orgSlug: string; lotId: string }>;
}

export default async function LotDetailPage({ params }: LotDetailPageProps) {
  const { orgSlug, lotId } = await params;

  // RBAC-EXCEPTION: Cross-module auth-only; no lots resource in frozen Resource union. Decision: rbac-legacy-auth-chain-migration 2026-04-19.
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

  const lotsService = makeLotService();
  let lotEntity;
  let summary;
  try {
    const result = await lotsService.getSummary(orgId, lotId);
    lotEntity = result.lot;
    summary = result.summary;
  } catch {
    redirect(`/${orgSlug}/farms`);
  }
  const lot = lotEntity.toSnapshot();

  const [expenses, mortalityEntities] = await Promise.all([
    makeExpenseService().listByLot(orgId, lotId),
    makeMortalityService().listByLot(orgId, lotId),
  ]);
  const mortalityLogs = mortalityEntities.map((e) => e.toJSON());
  const plainExpenses = expenses.map((e) => e.toSnapshot());

  return (
    <LotDetailClient
      orgSlug={orgSlug}
      lot={lot}
      summary={summary.toJSON()}
      expenses={plainExpenses}
      mortalityLogs={mortalityLogs}
    />
  );
}
