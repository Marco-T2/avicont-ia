import { redirect } from "next/navigation";
import { requireAuth, requireOrgAccess } from "@/features/shared";
import { ContactsService } from "@/features/contacts";
import { PayablesService } from "@/features/payables";
import PayableList from "@/components/accounting/payable-list";

interface CxPPageProps {
  params: Promise<{ orgSlug: string }>;
}

export default async function CxPPage({ params }: CxPPageProps) {
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
  const payablesService = new PayablesService(contactsService);

  const payables = await payablesService.list(orgId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Cuentas por Pagar</h1>
        <p className="text-gray-500 mt-1">
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
