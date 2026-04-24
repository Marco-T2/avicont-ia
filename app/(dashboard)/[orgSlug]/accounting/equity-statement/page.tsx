import { redirect } from "next/navigation";
import { requirePermission } from "@/features/permissions/server";
import { EquityStatementPageClient } from "@/components/accounting/equity-statement-page-client";

interface EquityStatementPageProps {
  params: Promise<{ orgSlug: string }>;
}

export default async function EquityStatementPage({ params }: EquityStatementPageProps) {
  const { orgSlug } = await params;

  try {
    await requirePermission("reports", "read", orgSlug);
  } catch {
    redirect(`/${orgSlug}`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Estado de Evolución del Patrimonio Neto</h1>
        <p className="text-gray-500 mt-1">
          Estado de Evolución del Patrimonio Neto (F-605) — Expresado en Bolivianos
        </p>
      </div>

      <EquityStatementPageClient orgSlug={orgSlug} />
    </div>
  );
}
