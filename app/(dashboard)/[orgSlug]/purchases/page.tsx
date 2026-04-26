import { redirect } from "next/navigation";
import { requirePermission } from "@/features/permissions/server";
import { PurchaseService } from "@/features/purchase/server";
import PurchaseList from "@/components/purchases/purchase-list";

interface PurchasesPageProps {
  params: Promise<{ orgSlug: string }>;
}

export default async function PurchasesPage({ params }: PurchasesPageProps) {
  const { orgSlug } = await params;

  let orgId: string;
  try {
    const result = await requirePermission("purchases", "read", orgSlug);
    orgId = result.orgId;
  } catch {
    redirect(`/${orgSlug}`);
  }

  const purchaseService = new PurchaseService();
  const purchases = await purchaseService.list(orgId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Compras</h1>
        <p className="text-gray-500 mt-1">
          Gestión de fletes, pollos faenados, compras generales y servicios
        </p>
      </div>

      <PurchaseList
        orgSlug={orgSlug}
        purchases={JSON.parse(JSON.stringify(purchases))}
      />
    </div>
  );
}
