import { redirect } from "next/navigation";
import { requirePermission } from "@/features/shared/permissions.server";
import { FinancialStatementsLanding } from "@/components/financial-statements/financial-statements-landing";

interface FinancialStatementsPageProps {
  params: Promise<{ orgSlug: string }>;
}

export default async function FinancialStatementsPage({
  params,
}: FinancialStatementsPageProps) {
  const { orgSlug } = await params;

  try {
    await requirePermission("reports", "read", orgSlug);
  } catch {
    redirect(`/${orgSlug}`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Estados Financieros</h1>
        <p className="text-gray-500 mt-1">
          Balance General y Estado de Resultados de la organización
        </p>
      </div>

      <FinancialStatementsLanding orgSlug={orgSlug} />
    </div>
  );
}
