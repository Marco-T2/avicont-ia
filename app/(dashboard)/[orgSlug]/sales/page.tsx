import { redirect } from "next/navigation";
import { requirePermission } from "@/features/shared/permissions.server";
import { SaleService } from "@/features/sale";
import SaleList from "@/components/sales/sale-list";

interface SalesPageProps {
  params: Promise<{ orgSlug: string }>;
}

export default async function SalesPage({ params }: SalesPageProps) {
  const { orgSlug } = await params;

  let orgId: string;
  try {
    const result = await requirePermission("sales", "read", orgSlug);
    orgId = result.orgId;
  } catch {
    redirect(`/${orgSlug}`);
  }

  const saleService = new SaleService();
  const sales = await saleService.list(orgId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Ventas General</h1>
        <p className="text-gray-500 mt-1">
          Gestión de ventas y cuentas por cobrar
        </p>
      </div>

      <SaleList
        orgSlug={orgSlug}
        initialSales={JSON.parse(JSON.stringify(sales))}
      />
    </div>
  );
}
