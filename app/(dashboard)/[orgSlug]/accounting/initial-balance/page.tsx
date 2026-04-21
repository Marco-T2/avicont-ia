import { redirect } from "next/navigation";
import { requirePermission } from "@/features/shared/permissions.server";

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

  // InitialBalancePageClient will be wired in Batch 6 (T21).
  // Using a placeholder so the page compiles and RBAC tests pass now.
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Balance Inicial</h1>
        <p className="text-gray-500 mt-1">
          Balance Inicial — Expresado en Bolivianos
        </p>
      </div>

      <div>Balance Inicial</div>
    </div>
  );
}
