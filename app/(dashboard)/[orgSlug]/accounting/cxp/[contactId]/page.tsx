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
 * RSC contact-ledger detail page — CxP (PROVEEDOR) sister of CxC. Next.js
 * 16 async params per `node_modules/next/dist/docs/01-app/03-api-reference/
 * 03-file-conventions/page.md`: `params: Promise<{...}>` +
 * `searchParams: Promise<{...}>`.
 *
 * Permission: `purchases:read` — mirrors the legacy `/cxp/page.tsx`
 * permission (parity with CxP surface). The `/api/.../contact-ledger`
 * endpoint independently enforces `reports:read`.
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

  const dateRange = dateRangeSchema.parse({
    dateFrom: typeof sp.dateFrom === "string" ? sp.dateFrom : undefined,
    dateTo: typeof sp.dateTo === "string" ? sp.dateTo : undefined,
  });
  const pagination = paginationQuerySchema.parse({
    page: sp.page,
    pageSize: sp.pageSize,
  });

  const [contacts, ledger] = await Promise.all([
    contactsService.list(orgId, { type: "PROVEEDOR" }),
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
        <h1 className="text-3xl font-bold">Libro Mayor por Proveedor</h1>
        <p className="text-muted-foreground mt-1">
          Movimientos del proveedor en formato libro mayor
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
        typeFilter="PROVEEDOR"
      />
    </div>
  );
}
