import { redirect } from "next/navigation";
import { requirePermission } from "@/features/permissions/server";
import { makeContactBalancesService } from "@/modules/contact-balances/presentation/server";
import CxcDashboardPageClient from "@/components/accounting/cxc-dashboard-page-client";

interface CxCPageProps {
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
 * /accounting/cxc — Dashboard de clientes con saldo abierto.
 * Spec REQ "Contact Dashboard (CxC/CxP)" + design D5.
 *
 * Permission `sales:read` heredado del pricing legacy (compatibilidad con
 * usuarios actuales). El detail page /accounting/cxc/[contactId] requiere
 * `reports:read` (spec REQ "API Contract — Contact Ledger").
 *
 * NOTE: this page REEMPLAZA el RSC legacy que cargaba `receivablesService.
 * list(orgId)` + `<ReceivableList />`. `ReceivableList` / `PayableList`
 * NO se eliminan — se reubican como tab dentro del contact detail en C8
 * (design D7/D8 + spec Non-Goals "Eliminar ReceivableList/PayableList").
 */
export default async function CxCPage({
  params,
  searchParams,
}: CxCPageProps) {
  const { orgSlug } = await params;
  const sp = await searchParams;

  let orgId: string;
  try {
    const result = await requirePermission("sales", "read", orgSlug);
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
    "CLIENTE",
    { includeZeroBalance, page, pageSize, sort, direction },
  );

  // Serialize boundary (Date → ISO string; balances already string per DEC-1)
  const serialized = JSON.parse(JSON.stringify(dashboard));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Cuentas por Cobrar</h1>
        <p className="text-muted-foreground mt-1">
          Clientes con saldo abierto — clic en Ver para el detalle por contacto
        </p>
      </div>

      <CxcDashboardPageClient
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
