import { redirect } from "next/navigation";
import { requirePermission } from "@/features/permissions/server";
import { VoucherTypesService } from "@/features/voucher-types/server";
import CorrelationAuditView from "@/components/accounting/correlation-audit-view";

interface CorrelationAuditPageProps {
  params: Promise<{ orgSlug: string }>;
}

export default async function CorrelationAuditPage({
  params,
}: CorrelationAuditPageProps) {
  const { orgSlug } = await params;

  let orgId: string;
  try {
    const result = await requirePermission("journal", "read", orgSlug);
    orgId = result.orgId;
  } catch {
    redirect(`/${orgSlug}`);
  }

  const voucherTypesService = new VoucherTypesService();
  const voucherTypes = await voucherTypesService.list(orgId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Auditoría de Correlativos</h1>
        <p className="text-gray-500 mt-1">
          Detecte saltos y duplicados en la numeración de referencia
        </p>
      </div>
      <CorrelationAuditView
        orgSlug={orgSlug}
        voucherTypes={JSON.parse(JSON.stringify(voucherTypes))}
      />
    </div>
  );
}
