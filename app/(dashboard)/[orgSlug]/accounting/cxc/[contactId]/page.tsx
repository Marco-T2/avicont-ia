import { redirect } from "next/navigation";
import { Tabs } from "radix-ui";
import { requirePermission } from "@/features/permissions/server";
import {
  makeLedgerService,
  dateRangeSchema,
} from "@/modules/accounting/presentation/server";
import { makeContactsService } from "@/modules/contacts/presentation/server";
import {
  makeReceivablesService,
  attachContacts,
} from "@/modules/receivables/presentation/server";
import { paginationQuerySchema } from "@/modules/shared/presentation/pagination.schema";
import ContactLedgerPageClient from "@/components/accounting/contact-ledger-page-client";
import ReceivableList from "@/components/accounting/receivable-list";

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
 *   - `receivablesService.list(orgId, { contactId })` + `attachContacts` —
 *     pre-filtered for the embedded "CxC individuales" tab (C8).
 *
 * Tabs (C8 — design D7/D8, spec Non-Goal "Eliminar ReceivableList"):
 *   - Default tab "Libro Mayor" → ContactLedgerPageClient (UX-first per
 *     spec — Libro Mayor is the primary view).
 *   - Tab "CxC individuales" → ReceivableList pre-filtered by contactId.
 *     ReceivableList internals untouched per
 *     [[paired_sister_default_no_surface]] — server-side filtering keeps the
 *     legacy component signature `{orgSlug, receivables}` intact.
 *   - Radix Tabs primitive (no shadcn ui/tabs wrapper exists in repo;
 *     sister precedent `components/contacts/contact-detail.tsx` uses the
 *     same `radix-ui` Tabs import + tailwind class shape).
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
  const receivablesService = makeReceivablesService();

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
  // to "fetch unless explicitly absent" — kept symmetric with sister) +
  // receivables pre-filtered by contactId for the embedded tab.
  const [contacts, ledger, receivableEntities] = await Promise.all([
    contactsService.list(orgId, { type: "CLIENTE" }),
    ledgerService.getContactLedgerPaginated(
      orgId,
      contactId,
      dateRange,
      undefined,
      pagination,
    ),
    receivablesService.list(orgId, { contactId }),
  ]);
  const receivables = await attachContacts(orgId, receivableEntities);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Libro Mayor por Cliente</h1>
        <p className="text-muted-foreground mt-1">
          Movimientos del cliente en formato libro mayor
        </p>
      </div>

      <Tabs.Root defaultValue="ledger">
        <Tabs.List className="flex border-b mb-4">
          <Tabs.Trigger
            value="ledger"
            className="px-4 py-2 text-sm font-medium text-muted-foreground border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-foreground transition-colors"
          >
            Libro Mayor
          </Tabs.Trigger>
          <Tabs.Trigger
            value="receivables"
            className="px-4 py-2 text-sm font-medium text-muted-foreground border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-foreground transition-colors"
          >
            CxC individuales
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="ledger">
          <ContactLedgerPageClient
            orgSlug={orgSlug}
            contacts={JSON.parse(JSON.stringify(contacts))}
            ledger={JSON.parse(JSON.stringify(ledger))}
            filters={{
              contactId,
              dateFrom:
                typeof sp.dateFrom === "string" ? sp.dateFrom : undefined,
              dateTo: typeof sp.dateTo === "string" ? sp.dateTo : undefined,
            }}
            typeFilter="CLIENTE"
          />
        </Tabs.Content>

        <Tabs.Content value="receivables">
          <div className="space-y-4">
            <ReceivableList
              orgSlug={orgSlug}
              receivables={JSON.parse(JSON.stringify(receivables))}
            />
          </div>
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
