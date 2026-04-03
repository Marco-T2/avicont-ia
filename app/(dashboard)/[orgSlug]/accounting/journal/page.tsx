import { redirect } from "next/navigation";
import { requireAuth, requireOrgAccess } from "@/features/shared";
import { JournalService, AccountsService } from "@/features/accounting";
import JournalPageClient from "@/components/accounting/journal-page-client";

interface JournalPageProps {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function JournalPage({
  params,
  searchParams,
}: JournalPageProps) {
  const { orgSlug } = await params;
  const sp = await searchParams;

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

  const journalService = new JournalService();
  const accountsService = new AccountsService();

  const filters: Record<string, unknown> = {};
  if (sp.dateFrom && typeof sp.dateFrom === "string") {
    filters.dateFrom = new Date(sp.dateFrom);
  }
  if (sp.dateTo && typeof sp.dateTo === "string") {
    filters.dateTo = new Date(sp.dateTo);
  }
  if (sp.voucherType && typeof sp.voucherType === "string") {
    filters.voucherType = sp.voucherType;
  }

  const entries = await journalService.list(orgId, filters);
  const accounts = await accountsService.list(orgId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Libro Diario</h1>
        <p className="text-gray-500 mt-1">
          Registro de asientos contables
        </p>
      </div>

      <JournalPageClient
        orgSlug={orgSlug}
        entries={JSON.parse(JSON.stringify(entries))}
        accounts={JSON.parse(JSON.stringify(accounts))}
      />
    </div>
  );
}
