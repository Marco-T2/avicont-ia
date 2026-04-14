import { redirect } from "next/navigation";
import { requireAuth, requireOrgAccess, requireRole } from "@/features/shared/middleware";
import { BalanceSheetPageClient } from "@/components/financial-statements/balance-sheet-page-client";

interface BalanceSheetPageProps {
  params: Promise<{ orgSlug: string }>;
}

export default async function BalanceSheetPage({
  params,
}: BalanceSheetPageProps) {
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

  // Solo owner, admin y contador pueden ver el Balance General (REQ-13)
  try {
    await requireRole(userId, orgId, ["owner", "admin", "contador"]);
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
