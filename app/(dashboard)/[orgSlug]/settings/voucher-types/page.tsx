import { redirect } from "next/navigation";
import { requirePermission } from "@/features/permissions/server";
import { VoucherTypesService } from "@/features/voucher-types/server";
import VoucherTypesManager from "@/components/settings/voucher-types-manager";

interface VoucherTypesPageProps {
  params: Promise<{ orgSlug: string }>;
}

export default async function VoucherTypesPage({ params }: VoucherTypesPageProps) {
  const { orgSlug } = await params;

  let orgId: string;
  try {
    const result = await requirePermission("accounting-config", "write", orgSlug);
    orgId = result.orgId;
  } catch {
    redirect(`/${orgSlug}`);
  }

  const service = new VoucherTypesService();
  const voucherTypes = await service.list(orgId, { includeCounts: true });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Tipos de Comprobante</h1>
        <p className="text-muted-foreground mt-1">
          Configuración de tipos de comprobante contable
        </p>
      </div>

      <VoucherTypesManager
        orgSlug={orgSlug}
        initialVoucherTypes={voucherTypes.map((vt) => ({
          id: vt.id,
          code: vt.code,
          name: vt.name,
          prefix: vt.prefix,
          description: vt.description,
          isActive: vt.isActive,
          _count: (vt as { _count?: { journalEntries: number } })._count,
        }))}
      />
    </div>
  );
}
