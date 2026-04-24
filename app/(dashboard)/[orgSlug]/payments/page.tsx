import { redirect } from "next/navigation";
import { requirePermission } from "@/features/permissions/server";
import { PaymentService } from "@/features/payment/server";
import { ContactsService } from "@/features/contacts/server";
import PaymentList from "@/components/payments/payment-list";

const paymentService = new PaymentService();
const contactsService = new ContactsService();

interface PaymentsPageProps {
  params: Promise<{ orgSlug: string }>;
}

export default async function PaymentsPage({ params }: PaymentsPageProps) {
  const { orgSlug } = await params;

  let orgId: string;
  try {
    const result = await requirePermission("payments", "read", orgSlug);
    orgId = result.orgId;
  } catch {
    redirect(`/${orgSlug}`);
  }

  const [payments, contacts] = await Promise.all([
    paymentService.list(orgId),
    contactsService.list(orgId),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Cobros y Pagos</h1>
        <p className="text-gray-500 mt-1">
          Gestión de cobros a clientes y pagos a proveedores
        </p>
      </div>

      <PaymentList
        orgSlug={orgSlug}
        payments={JSON.parse(JSON.stringify(payments))}
        contacts={JSON.parse(JSON.stringify(contacts))}
      />
    </div>
  );
}
