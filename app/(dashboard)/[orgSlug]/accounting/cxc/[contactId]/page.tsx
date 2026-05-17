import { redirect } from "next/navigation";
import { requirePermission } from "@/features/permissions/server";
import {
  makeLedgerService,
  dateRangeSchema,
} from "@/modules/accounting/presentation/server";
import { makeContactsService } from "@/modules/contacts/presentation/server";
import { paginationQuerySchema } from "@/modules/shared/presentation/pagination.schema";
import ContactLedgerPageClient from "@/components/accounting/contact-ledger-page-client";

/**
 * RSC contact-ledger detail page — CxC (CLIENTE) sister of the per-account
 * Libro Mayor. Next.js 16 async params per
 * `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md`:
 * `params: Promise<{...}>` + `searchParams: Promise<{...}>`.
 *
 * Permission: `sales:read` — mirrors the legacy `/cxc/page.tsx` permission
 * for parity with the rest of the CxC surface (the contact-ledger API
 * endpoint already requires `reports:read`; the UI page reuses the existing
 * CxC permission key so navigation gates do not drift between pages).
 *
 * Twin-call pattern (sister `accounting/ledger/page.tsx`):
 *   - `contactsService.list(orgId, { type: "CLIENTE" })` always — feeds the
 *     ContactSelector dropdown in the page client.
 *   - `ledgerService.getContactLedgerPaginated(...)` keyed by `[contactId]`
 *     path segment — the contactId path segment is REQUIRED for this page
 *     (vs sister where `accountId` is a query param that may be absent).
 */
interface CxcContactLedgerPageProps {
  params: Promise<{ orgSlug: string; contactId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function CxcContactLedgerPage({
  params,
  searchParams,
}: CxcContactLedgerPageProps) {
  const { orgSlug, contactId } = await params;
  const sp = await searchParams;

  let orgId: string;
  try {
    const result = await requirePermission("sales", "read", orgSlug);
    orgId = result.orgId;
  } catch {
    redirect(`/${orgSlug}`);
  }

  const contactsService = makeContactsService();
  const ledgerService = makeLedgerService();

  const dateRange = dateRangeSchema.parse({
    dateFrom: typeof sp.dateFrom === "string" ? sp.dateFrom : undefined,
    dateTo: typeof sp.dateTo === "string" ? sp.dateTo : undefined,
  });
  const pagination = paginationQuerySchema.parse({
    page: sp.page,
    pageSize: sp.pageSize,
  });

  // Twin-call: contacts always (for selector dropdown) + ledger when contactId
  // is present (it always is via path segment, so the conditional collapses
  // to "fetch unless explicitly absent" — kept symmetric with sister).
  const [contacts, ledger] = await Promise.all([
    contactsService.list(orgId, { type: "CLIENTE" }),
    ledgerService.getContactLedgerPaginated(
      orgId,
      contactId,
      dateRange,
      undefined,
      pagination,
    ),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Libro Mayor por Cliente</h1>
        <p className="text-muted-foreground mt-1">
          Movimientos del cliente en formato libro mayor
        </p>
      </div>

      <ContactLedgerPageClient
        orgSlug={orgSlug}
        contacts={JSON.parse(JSON.stringify(contacts))}
        ledger={JSON.parse(JSON.stringify(ledger))}
        filters={{
          contactId,
          dateFrom: typeof sp.dateFrom === "string" ? sp.dateFrom : undefined,
          dateTo: typeof sp.dateTo === "string" ? sp.dateTo : undefined,
        }}
        typeFilter="CLIENTE"
      />
    </div>
  );
}
