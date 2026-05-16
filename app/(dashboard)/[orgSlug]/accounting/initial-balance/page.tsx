import { redirect } from "next/navigation";
import { requirePermission } from "@/features/permissions/server";
import { InitialBalancePageClient } from "@/components/accounting/initial-balance-page-client";

interface InitialBalancePageProps {
  params: Promise<{ orgSlug: string }>;
}

export default async function InitialBalancePage({ params }: InitialBalancePageProps) {
  const { orgSlug } = await params;

  try {
    await requirePermission("reports", "read", orgSlug);
  } catch {
    redirect(`/${orgSlug}`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Balance Inicial</h1>
        <p className="text-muted-foreground mt-1">
          Estado patrimonial de apertura — Comprobante de Apertura (CA)
        </p>
      </div>

      <InitialBalancePageClient orgSlug={orgSlug} />
    </div>
  );
}
