import { redirect } from "next/navigation";
import { requireAuth, requireOrgAccess } from "@/features/shared";
import { PurchaseService } from "@/features/purchase";
import PurchaseList from "@/components/purchases/purchase-list";

interface PurchasesPageProps {
  params: Promise<{ orgSlug: string }>;
}

export default async function PurchasesPage({ params }: PurchasesPageProps) {
  const { orgSlug } = await params;

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

  const purchaseService = new PurchaseService();
  const purchases = await purchaseService.list(orgId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Compras y Servicios</h1>
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
