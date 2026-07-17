import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/modules/permissions/application/server";
import { makeVoucherTypesService } from "@/modules/voucher-types/presentation/server";
import { Button } from "@/components/ui/button";
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

  const voucherTypesService = makeVoucherTypesService();
  const voucherTypes = (await voucherTypesService.list(orgId)).map((vt) =>
    vt.toSnapshot(),
  );

  return (
    <div className="space-y-6">
      <Link href={`/${orgSlug}/informes`}>
        <Button variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Volver a Informes
        </Button>
      </Link>

      <div>
        <h1 className="text-3xl font-bold">Auditoría de Correlativos</h1>
        <p className="text-muted-foreground mt-1">
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
