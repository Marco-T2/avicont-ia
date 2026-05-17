import { redirect } from "next/navigation";
import { requirePermission } from "@/features/permissions/server";
import { makeContactBalancesService } from "@/modules/contact-balances/presentation/server";
import CxpDashboardPageClient from "@/components/accounting/cxp-dashboard-page-client";

interface CxPPageProps {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{
    includeZeroBalance?: string;
    page?: string;
    pageSize?: string;
    sort?: string;
    direction?: string;
  }>;
}

/**
 * /accounting/cxp — Dashboard de proveedores con saldo abierto.
 * Sister de cxc/page.tsx — design D5.
 *
 * Permission `purchases:read` heredado del legacy. Detail page
 * /accounting/cxp/[contactId] requiere `reports:read`.
 *
 * NOTE: REEMPLAZA RSC legacy que cargaba `payablesService.list(orgId)` +
 * `<PayableList />`. `PayableList` NO se elimina — reubicación a tab en C8.
 */
export default async function CxPPage({
  params,
  searchParams,
}: CxPPageProps) {
  const { orgSlug } = await params;
  const sp = await searchParams;

  let orgId: string;
  try {
    const result = await requirePermission("purchases", "read", orgSlug);
    orgId = result.orgId;
  } catch {
    redirect(`/${orgSlug}`);
  }

  const includeZeroBalance = sp.includeZeroBalance === "true";
  const page = sp.page ? Math.max(1, parseInt(sp.page, 10) || 1) : 1;
  const pageSize = sp.pageSize
    ? Math.min(100, Math.max(1, parseInt(sp.pageSize, 10) || 20))
    : 20;
  const sort =
    sp.sort === "name" || sp.sort === "lastMovementDate"
      ? sp.sort
      : "openBalance";
  const direction = sp.direction === "asc" ? "asc" : "desc";

  const service = makeContactBalancesService();
  const dashboard = await service.listContactsWithOpenBalance(
    orgId,
    "PROVEEDOR",
    { includeZeroBalance, page, pageSize, sort, direction },
  );

  const serialized = JSON.parse(JSON.stringify(dashboard));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Cuentas por Pagar</h1>
        <p className="text-muted-foreground mt-1">
          Proveedores con saldo abierto — clic en Ver para el detalle por
          contacto
        </p>
      </div>

      <CxpDashboardPageClient
        orgSlug={orgSlug}
        dashboard={serialized}
        filters={{
          includeZeroBalance,
          page,
          pageSize,
          sort,
          direction,
        }}
      />
    </div>
  );
}
