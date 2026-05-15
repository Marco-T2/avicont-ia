import { redirect } from "next/navigation";
import { requirePermission } from "@/features/permissions/server";
import {
  makeAccountsService,
  makeLedgerService,
  dateRangeSchema,
} from "@/modules/accounting/presentation/server";
import { paginationQuerySchema } from "@/modules/shared/presentation/pagination.schema";
import LedgerPageClient from "@/components/accounting/ledger-page-client";

/**
 * RSC ledger page — Next.js 16 searchParams: Promise<{...}> pattern
 * (confirmed via node_modules/next/dist/docs/01-app/03-api-reference/03-file-
 * conventions/page.md). Twin-call: accountsService.list always +
 * ledgerService.getAccountLedgerPaginated only when accountId in URL.
 * arch/§13/twin-call-rsc-canonical 3rd evidence.
 */
interface LedgerPageProps {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function LedgerPage({
  params,
  searchParams,
}: LedgerPageProps) {
  const { orgSlug } = await params;
  const sp = await searchParams;

  let orgId: string;
  try {
    const result = await requirePermission("journal", "read", orgSlug);
    orgId = result.orgId;
  } catch {
    redirect(`/${orgSlug}`);
  }

  const accountsService = makeAccountsService();
  const ledgerService = makeLedgerService();

  // Parse filters from URL searchParams
  const accountId = typeof sp.accountId === "string" ? sp.accountId : undefined;
  const periodId = typeof sp.periodId === "string" ? sp.periodId : undefined;
  const dateRange = dateRangeSchema.parse({
    dateFrom: typeof sp.dateFrom === "string" ? sp.dateFrom : undefined,
    dateTo: typeof sp.dateTo === "string" ? sp.dateTo : undefined,
  });
  const pagination = paginationQuerySchema.parse({
    page: sp.page,
    pageSize: sp.pageSize,
  });

  // Twin-call: accounts always + ledger only when accountId present
  const [accounts, ledgerResult] = await Promise.all([
    accountsService.list(orgId),
    accountId
      ? ledgerService.getAccountLedgerPaginated(
          orgId,
          accountId,
          dateRange,
          periodId,
          pagination,
        )
      : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Libro Mayor</h1>
        <p className="text-muted-foreground mt-1">
          Movimientos por cuenta contable
        </p>
      </div>

      <LedgerPageClient
        orgSlug={orgSlug}
        accounts={JSON.parse(JSON.stringify(accounts))}
        ledger={ledgerResult ? JSON.parse(JSON.stringify(ledgerResult)) : null}
        filters={{
          accountId,
          dateFrom: typeof sp.dateFrom === "string" ? sp.dateFrom : undefined,
          dateTo: typeof sp.dateTo === "string" ? sp.dateTo : undefined,
          periodId,
        }}
      />
    </div>
  );
}
