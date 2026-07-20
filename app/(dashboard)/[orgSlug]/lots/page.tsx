import { redirect } from "next/navigation";
import { requireAuth } from "@/modules/shared/presentation/middleware";
import { requireOrgAccess } from "@/modules/organizations/presentation/server";
import { makeLotService } from "@/modules/lot/presentation/server";
import LotsPageClient from "./lots-client";

interface LotsPageProps {
  params: Promise<{ orgSlug: string }>;
}

export default async function LotsPage({ params }: LotsPageProps) {
  const { orgSlug } = await params;

  // RBAC-EXCEPTION: Cross-module auth-only; no lots resource in
  // frozen Resource union (Marco I.2/I.3 lock; same exception applied
  // to legacy /farms/page.tsx per rbac-legacy-auth-chain-migration
  // 2026-04-19). Post-collapse REQ-204 mirrors that exact RBAC chain.
  let userId: string;
  try {
    const session = await requireAuth();
    userId = session.userId;
  } catch {
    return redirect("/sign-in");
  }

  let orgId: string;
  try {
    orgId = await requireOrgAccess(userId, orgSlug);
  } catch {
    return redirect("/select-org");
  }

  const lotsService = makeLotService();
  const entities = await lotsService.list(orgId);
  const lots = entities.map((e) => e.toSnapshot());

  return <LotsPageClient orgSlug={orgSlug} lots={lots} />;
}
