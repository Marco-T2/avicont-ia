import { redirect } from "next/navigation";
import { requireAuth, requireOrgAccess } from "@/features/shared";
import { LotsService } from "@/features/lots";
import { ExpensesService } from "@/features/expenses/expenses.service";
import { MortalityService } from "@/features/mortality/mortality.service";
import LotDetailClient from "./lot-detail-client";

interface LotDetailPageProps {
  params: Promise<{ orgSlug: string; lotId: string }>;
}

export default async function LotDetailPage({ params }: LotDetailPageProps) {
  const { orgSlug, lotId } = await params;

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
