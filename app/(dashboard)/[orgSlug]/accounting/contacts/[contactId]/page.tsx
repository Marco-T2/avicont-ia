import { redirect } from "next/navigation";
import { requirePermission } from "@/features/permissions/server";
import { makeContactsService } from "@/modules/contacts/presentation/server";
import type { ContactWithBalance } from "@/modules/contacts/presentation/index";
import { makeContactBalancesService } from "@/modules/contact-balances/presentation/server";
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

  const contactsService = makeContactsService();
  const balancesService = makeContactBalancesService();

  const [contact, balanceSummary] = await Promise.all([
    contactsService.getById(orgId, contactId).then((c) => c.toSnapshot()),
    balancesService.getBalanceSummary(orgId, contactId),
  ]);

  const contactWithBalance = { ...contact, balanceSummary };

  return (
    <div className="space-y-6">
      <ContactDetail
        orgSlug={orgSlug}
        contact={contactWithBalance as unknown as ContactWithBalance}
      />
    </div>
  );
}
