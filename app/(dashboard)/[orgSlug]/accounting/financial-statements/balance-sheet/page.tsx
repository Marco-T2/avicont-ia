import { redirect } from "next/navigation";
import { requirePermission } from "@/features/shared/permissions.server";
import { BalanceSheetPageClient } from "@/components/financial-statements/balance-sheet-page-client";

interface BalanceSheetPageProps {
  params: Promise<{ orgSlug: string }>;
}

export default async function BalanceSheetPage({
  params,
}: BalanceSheetPageProps) {
  const { orgSlug } = await params;

  try {
    await requirePermission("reports", "read", orgSlug);
  } catch {
    redirect(`/${orgSlug}`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Balance General</h1>
        <p className="text-gray-500 mt-1">
          Estado de Situación Patrimonial — Activos, Pasivos y Patrimonio
        </p>
      </div>

      <BalanceSheetPageClient orgSlug={orgSlug} />
    </div>
  );
}
