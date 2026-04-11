import { redirect } from "next/navigation";
import { requireAuth, requireOrgAccess } from "@/features/shared";
import { DispatchService } from "@/features/dispatch";
import { FiscalPeriodsService } from "@/features/fiscal-periods";
import DispatchList from "@/components/dispatches/dispatch-list";
import type { DispatchFilters } from "@/features/dispatch";

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

  const dispatchService = new DispatchService();
  const periodsService = new FiscalPeriodsService();

  const filters: DispatchFilters = {};
  if (sp.periodId && typeof sp.periodId === "string") {
    filters.periodId = sp.periodId;
  }
  if (sp.dispatchType && typeof sp.dispatchType === "string") {
    filters.dispatchType = sp.dispatchType as DispatchFilters["dispatchType"];
  }
  if (sp.status && typeof sp.status === "string") {
    filters.status = sp.status as DispatchFilters["status"];
  }

  const [dispatches, periods] = await Promise.all([
    dispatchService.list(orgId, filters),
    periodsService.list(orgId),
  ]);

  // Client-side referenceNumber filter (search by prefix/contains)
  const refSearch =
    sp.referenceNumber && typeof sp.referenceNumber === "string"
      ? sp.referenceNumber.trim()
      : undefined;

  const filteredDispatches = refSearch
    ? dispatches.filter(
        (d) =>
          d.referenceNumber !== null &&
          String(d.referenceNumber).includes(refSearch),
      )
    : dispatches;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Ventas y Despachos</h1>
        <p className="text-gray-500 mt-1">
          Gestión de ventas generales, notas de despacho y boletas cerradas
        </p>
      </div>

      <DispatchList
        orgSlug={orgSlug}
        dispatches={JSON.parse(JSON.stringify(filteredDispatches))}
        periods={JSON.parse(JSON.stringify(periods))}
        filters={{
          periodId: typeof sp.periodId === "string" ? sp.periodId : undefined,
          dispatchType:
            typeof sp.dispatchType === "string" ? sp.dispatchType : undefined,
          status: typeof sp.status === "string" ? sp.status : undefined,
          referenceNumber:
            typeof sp.referenceNumber === "string"
              ? sp.referenceNumber
              : undefined,
        }}
      />
    </div>
  );
}
