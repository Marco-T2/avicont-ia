import { redirect } from "next/navigation";
import { requirePermission } from "@/features/permissions/server";
import { AccountsService } from "@/features/accounting/server";
import AccountsPageClient from "@/components/accounting/accounts-page-client";

interface AccountsPageProps {
  params: Promise<{ orgSlug: string }>;
}

export default async function AccountsPage({ params }: AccountsPageProps) {
  const { orgSlug } = await params;

  let orgId: string;
  try {
    const result = await requirePermission("accounting-config", "read", orgSlug);
    orgId = result.orgId;
  } catch {
    redirect(`/${orgSlug}`);
  }

  const service = new AccountsService();
  const tree = await service.getTree(orgId);
  const allAccounts = await service.list(orgId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Plan de Cuentas</h1>
        <p className="text-gray-500 mt-1">
          Estructura de cuentas contables de la organizacion
        </p>
      </div>

      <AccountsPageClient
        orgSlug={orgSlug}
        tree={tree}
        allAccounts={allAccounts}
      />
    </div>
  );
}
