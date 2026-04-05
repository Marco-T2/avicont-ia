import { redirect, notFound } from "next/navigation";
import { requireAuth, requireOrgAccess } from "@/features/shared";
import { PaymentService } from "@/features/payment";
import { ContactsService } from "@/features/contacts";
import { FiscalPeriodsService } from "@/features/fiscal-periods";
import PaymentForm from "@/components/payments/payment-form";

interface PaymentDetailPageProps {
  params: Promise<{ orgSlug: string; paymentId: string }>;
}

export default async function PaymentDetailPage({
  params,
}: PaymentDetailPageProps) {
  const { orgSlug, paymentId } = await params;

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

  const paymentService = new PaymentService();
  const contactsService = new ContactsService();
  const periodsService = new FiscalPeriodsService();

  let payment;
  try {
    payment = await paymentService.getById(orgId, paymentId);
  } catch {
    notFound();
  }

  const [contacts, periods] = await Promise.all([
    contactsService.list(orgId),
    periodsService.list(orgId),
  ]);

  const openPeriods = periods.filter((p) => p.status === "OPEN");

  return (
    <div className="space-y-6">
      <PaymentForm
        orgSlug={orgSlug}
        contacts={JSON.parse(JSON.stringify(contacts))}
        periods={JSON.parse(JSON.stringify(openPeriods))}
        existingPayment={JSON.parse(JSON.stringify(payment))}
      />
    </div>
  );
}
