import { redirect } from "next/navigation";
import { requireAuth, requireOrgAccess } from "@/features/shared";
import { ContactsService } from "@/features/contacts";
import { ReceivablesService } from "@/features/receivables";
import { PayablesService } from "@/features/payables";
import ContactDetail from "@/components/contacts/contact-detail";

interface ContactDetailPageProps {
  params: Promise<{ orgSlug: string; contactId: string }>;
}

export default async function ContactDetailPage({ params }: ContactDetailPageProps) {
  const { orgSlug, contactId } = await params;

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
  const payablesService = new PayablesService(contactsService);
  contactsService.setReceivablesService(receivablesService);
  contactsService.setPayablesService(payablesService);

  const [contact, balanceSummary] = await Promise.all([
    contactsService.getById(orgId, contactId),
    contactsService.getBalanceSummary(orgId, contactId),
  ]);

  const contactWithBalance = { ...contact, balanceSummary };

  return (
    <div className="space-y-6">
      <ContactDetail
        orgSlug={orgSlug}
        contact={JSON.parse(JSON.stringify(contactWithBalance))}
      />
    </div>
  );
}
