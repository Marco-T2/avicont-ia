import { redirect } from "next/navigation";
import { requireAuth, requireOrgAccess, requireRole } from "@/features/shared/middleware";
import { IncomeStatementPageClient } from "@/components/financial-statements/income-statement-page-client";

interface IncomeStatementPageProps {
  params: Promise<{ orgSlug: string }>;
}

export default async function IncomeStatementPage({
  params,
}: IncomeStatementPageProps) {
  const { orgSlug } = await params;

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

  // Solo owner, admin y contador pueden ver el Estado de Resultados (REQ-13)
  try {
    await requireRole(userId, orgId, ["owner", "admin", "contador"]);
  } catch {
    redirect(`/${orgSlug}`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Estado de Resultados</h1>
        <p className="text-gray-500 mt-1">
          Análisis de Ingresos y Gastos por período o rango de fechas
        </p>
      </div>

      <IncomeStatementPageClient orgSlug={orgSlug} />
    </div>
  );
}
