import { redirect } from "next/navigation";
import { requirePermission } from "@/features/permissions/server";
import {
  makeReceivablesService,
  attachContacts,
} from "@/modules/receivables/presentation/server";
import ReceivableList from "@/components/accounting/receivable-list";

interface CxCPageProps {
  params: Promise<{ orgSlug: string }>;
}

export default async function CxCPage({ params }: CxCPageProps) {
  const { orgSlug } = await params;

  let orgId: string;
  try {
    const result = await requirePermission("sales", "read", orgSlug);
    orgId = result.orgId;
  } catch {
    redirect(`/${orgSlug}`);
  }

  const receivablesService = makeReceivablesService();

  const items = await receivablesService.list(orgId);
  const receivables = await attachContacts(orgId, items);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Cuentas por Cobrar</h1>
        <p className="text-muted-foreground mt-1">
          Gestión de cuentas pendientes de cobro
        </p>
      </div>

      <ReceivableList
        orgSlug={orgSlug}
        receivables={JSON.parse(JSON.stringify(receivables))}
      />
    </div>
  );
}
