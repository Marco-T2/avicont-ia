import { redirect } from "next/navigation";
import { requireAuth } from "@/features/shared";
import { requireOrgAccess } from "@/features/organizations/server";
import { LotsService } from "@/features/lots/server";
import { ExpensesService } from "@/features/expenses/expenses.service";
import { MortalityService } from "@/features/mortality/mortality.service";
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

  const lotsService = new LotsService();
  let summary;
  try {
    summary = await lotsService.getSummary(orgId, lotId);
  } catch {
    redirect(`/${orgSlug}/farms`);
  }

  const [expenses, mortalityLogs] = await Promise.all([
    new ExpensesService().listByLot(orgId, lotId),
    new MortalityService().listByLot(orgId, lotId),
  ]);

  return (
    <LotDetailClient
      orgSlug={orgSlug}
      summary={summary}
      expenses={expenses}
      mortalityLogs={mortalityLogs}
    />
  );
}
