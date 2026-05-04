import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/features/permissions/server";
import { makeVoucherTypesService } from "@/modules/voucher-types/presentation/server";
import { Button } from "@/components/ui/button";
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

  const service = makeVoucherTypesService();
  const voucherTypes = (
    await service.list(orgId, { includeCounts: true })
  ).map((vt) => vt.toSnapshot());

  return (
    <div className="space-y-6">
      <Link href={`/${orgSlug}/settings`}>
        <Button variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Volver a Configuración
        </Button>
      </Link>

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
          _count: vt._count,
        }))}
      />
    </div>
  );
}
