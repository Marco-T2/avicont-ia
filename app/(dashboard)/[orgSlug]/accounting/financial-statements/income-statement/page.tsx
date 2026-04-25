import { redirect } from "next/navigation";
import { requirePermission } from "@/features/permissions/server";
import { IncomeStatementPageClient } from "@/components/financial-statements/income-statement-page-client";

interface IncomeStatementPageProps {
  params: Promise<{ orgSlug: string }>;
}

export default async function IncomeStatementPage({
  params,
}: IncomeStatementPageProps) {
  const { orgSlug } = await params;

  try {
    await requirePermission("reports", "read", orgSlug);
  } catch {
    redirect(`/${orgSlug}`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Estado de Resultados</h1>
        <p className="text-muted-foreground mt-1">
          Análisis de Ingresos y Gastos por período o rango de fechas
        </p>
      </div>

      <IncomeStatementPageClient orgSlug={orgSlug} />
    </div>
  );
}
