import { redirect } from "next/navigation";
import { requirePermission } from "@/features/permissions/server";
import { makeContactBalancesService } from "@/modules/contact-balances/presentation/server";
import ContactList from "@/components/contacts/contact-list";

interface ContactsPageProps {
  params: Promise<{ orgSlug: string }>;
}

export default async function ContactsPage({ params }: ContactsPageProps) {
  const { orgSlug } = await params;

  let orgId: string;
  try {
    const result = await requirePermission("contacts", "read", orgSlug);
    orgId = result.orgId;
  } catch {
    redirect(`/${orgSlug}`);
  }

  const contacts = await makeContactBalancesService().listWithBalancesFlat(
    orgId,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Contactos</h1>
        <p className="text-muted-foreground mt-1">
          Gestión de clientes, proveedores y otros contactos
        </p>
      </div>

      <ContactList
        orgSlug={orgSlug}
        contacts={JSON.parse(JSON.stringify(contacts))}
      />
    </div>
  );
}
