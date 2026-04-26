import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/features/permissions/server";
import { ENTITY_TYPE_LABELS } from "@/features/audit";
import {
  AuditService,
  voucherHistoryParamsSchema,
} from "@/features/audit/server";
import { Button } from "@/components/ui/button";
import { AuditDetailTimeline } from "@/components/audit/audit-detail-timeline";

interface AuditDetailPageProps {
  params: Promise<{
    orgSlug: string;
    entityType: string;
    entityId: string;
  }>;
}

export default async function AuditDetailPage({
  params,
}: AuditDetailPageProps) {
  const raw = await params;

  let orgId: string;
  try {
    ({ orgId } = await requirePermission("audit", "read", raw.orgSlug));
  } catch {
    redirect(`/${raw.orgSlug}`);
  }

  // Validar entityType contra las 5 cabeceras permitidas (sales/purchases/
  // payments/dispatches/journal_entries). Cualquier otro → 404.
  const parsed = voucherHistoryParamsSchema.safeParse(raw);
  if (!parsed.success) {
    notFound();
  }

  const { entityType, entityId } = parsed.data;

  const events = await new AuditService().getVoucherHistory(
    orgId,
    entityType,
    entityId,
  );

  // Serializar Dates para el client component.
  const serialisedEvents = JSON.parse(JSON.stringify(events));

  return (
    <div className="space-y-6">
      <Link href={`/${raw.orgSlug}/audit`}>
        <Button variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Volver a Auditoría
        </Button>
      </Link>

      <div>
        <h1 className="text-3xl font-bold">
          Auditoría · {ENTITY_TYPE_LABELS[entityType]} · {entityId}
        </h1>
        <p className="mt-1 text-muted-foreground">Historial completo del comprobante</p>
      </div>

      <AuditDetailTimeline events={serialisedEvents} />
    </div>
  );
}
