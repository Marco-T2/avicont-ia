import { redirect } from "next/navigation";
import { Tabs } from "radix-ui";
import { requirePermission } from "@/features/permissions/server";
import {
  makeLedgerService,
  dateRangeSchema,
} from "@/modules/accounting/presentation/server";
import { makeContactsService } from "@/modules/contacts/presentation/server";
import {
  makePayablesService,
  attachContacts,
} from "@/modules/payables/presentation/server";
import { paginationQuerySchema } from "@/modules/shared/presentation/pagination.schema";
import ContactLedgerPageClient from "@/components/accounting/contact-ledger-page-client";
import PayableList from "@/components/accounting/payable-list";

/**
 * RSC contact-ledger detail page — CxP (PROVEEDOR) sister of CxC. Next.js
 * 16 async params per `node_modules/next/dist/docs/01-app/03-api-reference/
 * 03-file-conventions/page.md`: `params: Promise<{...}>` +
 * `searchParams: Promise<{...}>`.
 *
 * Permission: `purchases:read` — mirrors the legacy `/cxp/page.tsx`
 * permission (parity with CxP surface). The `/api/.../contact-ledger`
 * endpoint independently enforces `reports:read`.
 *
 * Tabs (C8 — sister of cxc/[contactId]/page.tsx, design D7/D8, spec
 * Non-Goal "Eliminar PayableList"):
 *   - Default tab "Libro Mayor" → ContactLedgerPageClient.
 *   - Tab "CxP individuales" → PayableList pre-filtered by contactId.
 *     PayableList internals untouched per
 *     [[paired_sister_default_no_surface]].
 */
interface CxpContactLedgerPageProps {
  params: Promise<{ orgSlug: string; contactId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function CxpContactLedgerPage({
  params,
  searchParams,
}: CxpContactLedgerPageProps) {
  const { orgSlug, contactId } = await params;
  const sp = await searchParams;

  let orgId: string;
  try {
    const result = await requirePermission("purchases", "read", orgSlug);
    orgId = result.orgId;
  } catch {
    redirect(`/${orgSlug}`);
  }

  const contactsService = makeContactsService();
  const ledgerService = makeLedgerService();
  const payablesService = makePayablesService();

  const dateRange = dateRangeSchema.parse({
    dateFrom: typeof sp.dateFrom === "string" ? sp.dateFrom : undefined,
    dateTo: typeof sp.dateTo === "string" ? sp.dateTo : undefined,
  });
  const pagination = paginationQuerySchema.parse({
    page: sp.page,
    pageSize: sp.pageSize,
  });

  const [contacts, ledger, payableEntities] = await Promise.all([
    contactsService.list(orgId, { type: "PROVEEDOR" }),
    ledgerService.getContactLedgerPaginated(
      orgId,
      contactId,
      dateRange,
      undefined,
      pagination,
    ),
    payablesService.list(orgId, { contactId }),
  ]);
  const payables = await attachContacts(orgId, payableEntities);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Libro Mayor por Proveedor</h1>
        <p className="text-muted-foreground mt-1">
          Movimientos del proveedor en formato libro mayor
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
            value="payables"
            className="px-4 py-2 text-sm font-medium text-muted-foreground border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-foreground transition-colors"
          >
            CxP individuales
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
            typeFilter="PROVEEDOR"
          />
        </Tabs.Content>

        <Tabs.Content value="payables">
          <div className="space-y-4">
            <PayableList
              orgSlug={orgSlug}
              payables={JSON.parse(JSON.stringify(payables))}
            />
          </div>
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
