import { redirect } from "next/navigation";
import { requireAuth, requireOrgAccess } from "@/features/shared";
import { ContactsService } from "@/features/contacts";
import { ReceivablesService } from "@/features/receivables";
import ReceivableList from "@/components/accounting/receivable-list";

interface CxCPageProps {
  params: Promise<{ orgSlug: string }>;
}

export default async function CxCPage({ params }: CxCPageProps) {
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
