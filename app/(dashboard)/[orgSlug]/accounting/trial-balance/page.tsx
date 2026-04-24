import { redirect } from "next/navigation";
import { requirePermission } from "@/features/permissions/server";
import { TrialBalancePageClient } from "@/components/accounting/trial-balance-page-client";

interface TrialBalancePageProps {
  params: Promise<{ orgSlug: string }>;
}

export default async function TrialBalancePage({ params }: TrialBalancePageProps) {
  const { orgSlug } = await params;

  try {
    await requirePermission("reports", "read", orgSlug);
  } catch {
    redirect(`/${orgSlug}`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Balance de Comprobación</h1>
        <p className="text-gray-500 mt-1">
          Balance de Comprobación de Sumas y Saldos — Todos los tipos de asiento
        </p>
      </div>

      <TrialBalancePageClient orgSlug={orgSlug} />
    </div>
  );
}
