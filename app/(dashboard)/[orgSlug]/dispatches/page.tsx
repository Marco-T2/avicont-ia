import { redirect } from "next/navigation";
import { requirePermission } from "@/features/permissions/server";
import { HubService, makeDispatchService } from "@/modules/dispatch/presentation/server";
import { makeSaleService } from "@/modules/sale/presentation/composition-root";
import DispatchList from "@/components/dispatches/dispatch-list";
import type { HubFilters } from "@/modules/dispatch/presentation";

interface DispatchesPageProps {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function DispatchesPage({
  params,
  searchParams,
}: DispatchesPageProps) {
  const { orgSlug } = await params;
  const sp = await searchParams;

  let orgId: string;
  try {
    const result = await requirePermission("sales", "read", orgSlug);
    orgId = result.orgId;
  } catch {
    redirect(`/${orgSlug}`);
  }

  // SSR: call HubService directly — no network round-trip (D5 of design)
  const hubService = new HubService(makeSaleService(), makeDispatchService());

  const filters: HubFilters = {};
  if (sp.type && typeof sp.type === "string") {
    filters.type = sp.type as HubFilters["type"];
  }
  if (sp.status && typeof sp.status === "string") {
    filters.status = sp.status as HubFilters["status"];
  }
  if (sp.contactId && typeof sp.contactId === "string") {
    filters.contactId = sp.contactId;
  }
  if (sp.periodId && typeof sp.periodId === "string") {
    filters.periodId = sp.periodId;
  }
  if (sp.dateFrom && typeof sp.dateFrom === "string") {
    filters.dateFrom = new Date(sp.dateFrom);
  }
  if (sp.dateTo && typeof sp.dateTo === "string") {
    filters.dateTo = new Date(sp.dateTo);
  }

  const { items } = await hubService.listHub(orgId, filters);

  // Serialise Dates to plain objects for client component (Next.js requirement)
  const serialisedItems = JSON.parse(JSON.stringify(items));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Ventas</h1>
        <p className="text-gray-500 mt-1">
          Gestión de ventas generales, notas de despacho y boletas cerradas
        </p>
      </div>

      <DispatchList
        orgSlug={orgSlug}
        items={serialisedItems}
        filters={{
          type: typeof sp.type === "string" ? sp.type : undefined,
          status: typeof sp.status === "string" ? sp.status : undefined,
          contactId: typeof sp.contactId === "string" ? sp.contactId : undefined,
          periodId: typeof sp.periodId === "string" ? sp.periodId : undefined,
          dateFrom: typeof sp.dateFrom === "string" ? sp.dateFrom : undefined,
          dateTo: typeof sp.dateTo === "string" ? sp.dateTo : undefined,
        }}
      />
    </div>
  );
}
