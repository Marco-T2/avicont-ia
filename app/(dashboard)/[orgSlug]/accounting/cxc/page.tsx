import { redirect } from "next/navigation";
import { requirePermission } from "@/features/shared/permissions.server";
import { ContactsService } from "@/features/contacts";
import { ReceivablesService } from "@/features/receivables";
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

  const contactsService = new ContactsService();
  const receivablesService = new ReceivablesService(contactsService);

  const receivables = await receivablesService.list(orgId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Cuentas por Cobrar</h1>
        <p className="text-gray-500 mt-1">
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
