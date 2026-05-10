import { redirect } from "next/navigation";
import { requirePermission } from "@/features/permissions/server";
import { PaymentService } from "@/modules/payment/presentation/server";
import { makeContactsService } from "@/modules/contacts/presentation/server";
import PaymentList from "@/components/payments/payment-list";
import { paginationQuerySchema } from "@/modules/shared/presentation/pagination.schema";
import type {
  PaymentFilters,
  PaymentStatus,
  PaymentMethod,
} from "@/modules/payment/presentation/server";

const paymentService = new PaymentService();
const contactsService = makeContactsService();

interface PaymentsPageProps {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function PaymentsPage({ params, searchParams }: PaymentsPageProps) {
  const { orgSlug } = await params;
  const sp = await searchParams;

  let orgId: string;
  try {
    const result = await requirePermission("payments", "read", orgSlug);
    orgId = result.orgId;
  } catch {
    redirect(`/${orgSlug}`);
  }

  const pagination = paginationQuerySchema.parse({
    page: sp.page,
    pageSize: sp.pageSize,
  });

  const statusFilter = typeof sp.status === "string" ? sp.status : undefined;
  const contactIdFilter = typeof sp.contactId === "string" ? sp.contactId : undefined;
  const methodFilter = typeof sp.method === "string" ? sp.method : undefined;

  const filters: PaymentFilters = {};
  if (statusFilter) filters.status = statusFilter as PaymentStatus;
  if (contactIdFilter) filters.contactId = contactIdFilter;
  if (methodFilter) filters.method = methodFilter as PaymentMethod;

  const [paginated, contacts] = await Promise.all([
    paymentService.listPaginated(orgId, filters, pagination),
    contactsService.list(orgId).then((entities) => entities.map((c) => c.toSnapshot())),
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
        items={JSON.parse(JSON.stringify(paginated.items))}
        total={paginated.total}
        page={paginated.page}
        pageSize={paginated.pageSize}
        totalPages={paginated.totalPages}
        contacts={contacts}
        statusFilter={statusFilter}
        contactIdFilter={contactIdFilter}
        methodFilter={methodFilter}
      />
    </div>
  );
}
