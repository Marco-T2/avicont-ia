import { redirect } from "next/navigation";
import { requireAuth } from "@/features/shared";
import { requireOrgAccess } from "@/modules/organizations/presentation/server";
import { makeFarmService } from "@/modules/farm/presentation/server";
import { makeLotService } from "@/modules/lot/presentation/server";
import { makeExpenseService } from "@/modules/expense/presentation/server";
import { makeMortalityService } from "@/modules/mortality/presentation/server";
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
  const expensesService = makeExpenseService();
  const mortalityService = makeMortalityService();

  const lotEntities = await lotsService.listByFarm(orgId, farmId);
  const lotSnapshots = lotEntities.map((l) => l.toSnapshot());

  const [lotsWithSummaryRaw, allExpenses, allMortality] = await Promise.all([
    Promise.all(
      lotSnapshots.map(async (lot) => {
        const { summary } = await lotsService.getSummary(orgId, lot.id);
        return { lot, summary: summary.toJSON() };
      }),
    ),
    Promise.all(
      lotSnapshots.map((l) => expensesService.listByLot(orgId, l.id)),
    ),
    Promise.all(
      lotSnapshots.map((l) => mortalityService.listByLot(orgId, l.id)),
    ),
  ]);

  // C1 server-slice per-lot recent N (sort desc by date + slice top N) — granjero expand AccordionContent
  const lotsWithSummary = lotsWithSummaryRaw.map((entry, i) => {
    const recentExpenses = [...allExpenses[i]]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10)
      .map((e) => e.toSnapshot());
    const recentMortality = allMortality[i]
      .map((m) => m.toJSON())
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
    return {
      ...entry,
      recentExpenses,
      recentMortality,
    };
  });

  // farmMetrics aggregation — current-month scoping (granjero operativo mes corriente)
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const inCurrentMonth = (d: Date | string): boolean => {
    const date = typeof d === "string" ? new Date(d) : d;
    return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
  };

  const pollosTotales = lotsWithSummary.reduce(
    (sum, { summary }) => sum + summary.aliveCount,
    0,
  );
  const gastoMes = allExpenses
    .flat()
    .filter((e) => inCurrentMonth(e.date))
    .reduce((sum, e) => sum + Number(e.amount), 0);
  const mortalidadMes = allMortality
    .flat()
    .map((m) => m.toJSON())
    .filter((m) => inCurrentMonth(m.date))
    .reduce((sum, m) => sum + m.count, 0);

  const farmMetrics = { pollosTotales, gastoMes, mortalidadMes };

  return (
    <FarmDetailClient
      orgSlug={orgSlug}
      farm={farm}
      lots={lotsWithSummary}
      farmMetrics={farmMetrics}
    />
  );
}
