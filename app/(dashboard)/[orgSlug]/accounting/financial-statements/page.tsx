import { redirect } from "next/navigation";
import { requireAuth, requireOrgAccess, requireRole } from "@/features/shared/middleware";
import { FinancialStatementsLanding } from "@/components/financial-statements/financial-statements-landing";

interface FinancialStatementsPageProps {
  params: Promise<{ orgSlug: string }>;
}

export default async function FinancialStatementsPage({
  params,
}: FinancialStatementsPageProps) {
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

  // Solo owner, admin y contador pueden acceder a estados financieros (REQ-13)
  try {
    await requireRole(userId, orgId, ["owner", "admin", "contador"]);
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
