import { redirect } from "next/navigation";
import { requireAuth, requireOrgAccess } from "@/features/shared";
import { ContactsService } from "@/features/contacts";
import { FiscalPeriodsService } from "@/features/fiscal-periods";
import PaymentForm from "@/components/payments/payment-form";

interface NewPaymentPageProps {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ type?: string }>;
}

export default async function NewPaymentPage({
  params,
  searchParams,
}: NewPaymentPageProps) {
  const { orgSlug } = await params;
  const { type } = await searchParams;

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
  const periodsService = new FiscalPeriodsService();

  const [contacts, periods] = await Promise.all([
    contactsService.list(orgId),
    periodsService.list(orgId),
  ]);

  // Only show OPEN periods
  const openPeriods = periods.filter((p) => p.status === "OPEN");

  // Determine default type from query param
  const defaultType =
    type === "PAGO" ? "PAGO" : type === "COBRO" ? "COBRO" : undefined;

  return (
    <div className="space-y-6">
      <PaymentForm
        orgSlug={orgSlug}
        contacts={JSON.parse(JSON.stringify(contacts))}
        periods={JSON.parse(JSON.stringify(openPeriods))}
        defaultType={defaultType}
      />
    </div>
  );
}
