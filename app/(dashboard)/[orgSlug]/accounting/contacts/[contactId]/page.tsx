import { redirect } from "next/navigation";
import { requirePermission } from "@/features/permissions/server";
import { ContactsService } from "@/features/contacts/server";
import ContactDetail from "@/components/contacts/contact-detail";

interface ContactDetailPageProps {
  params: Promise<{ orgSlug: string; contactId: string }>;
}

export default async function ContactDetailPage({ params }: ContactDetailPageProps) {
  const { orgSlug, contactId } = await params;

  let orgId: string;
  try {
    const result = await requirePermission("contacts", "read", orgSlug);
    orgId = result.orgId;
  } catch {
    redirect(`/${orgSlug}`);
  }

  const contactsService = new ContactsService();

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
