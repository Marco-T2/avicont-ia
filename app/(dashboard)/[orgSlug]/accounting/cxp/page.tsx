import { redirect } from "next/navigation";
import { requirePermission } from "@/features/permissions/server";
import {
  makePayablesService,
  attachContacts,
} from "@/modules/payables/presentation/server";
import PayableList from "@/components/accounting/payable-list";

interface CxPPageProps {
  params: Promise<{ orgSlug: string }>;
}

export default async function CxPPage({ params }: CxPPageProps) {
  const { orgSlug } = await params;

  let orgId: string;
  try {
    const result = await requirePermission("purchases", "read", orgSlug);
    orgId = result.orgId;
  } catch {
    redirect(`/${orgSlug}`);
  }

  const payablesService = makePayablesService();

  const items = await payablesService.list(orgId);
  const payables = await attachContacts(orgId, items);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Cuentas por Pagar</h1>
        <p className="text-muted-foreground mt-1">
          Gestión de cuentas pendientes de pago
        </p>
      </div>

      <PayableList
        orgSlug={orgSlug}
        payables={JSON.parse(JSON.stringify(payables))}
      />
    </div>
  );
}
