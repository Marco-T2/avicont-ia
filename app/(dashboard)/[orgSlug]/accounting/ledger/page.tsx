import { redirect } from "next/navigation";
import { requireAuth, requireOrgAccess } from "@/features/shared";
import { AccountsService } from "@/features/accounting";
import LedgerPageClient from "@/components/accounting/ledger-page-client";

interface LedgerPageProps {
  params: Promise<{ orgSlug: string }>;
}

export default async function LedgerPage({ params }: LedgerPageProps) {
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

  const accountsService = new AccountsService();
  const accounts = await accountsService.list(orgId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Libro Mayor</h1>
        <p className="text-gray-500 mt-1">
          Movimientos por cuenta contable
        </p>
      </div>

      <LedgerPageClient
        orgSlug={orgSlug}
        accounts={JSON.parse(JSON.stringify(accounts))}
      />
    </div>
  );
}
