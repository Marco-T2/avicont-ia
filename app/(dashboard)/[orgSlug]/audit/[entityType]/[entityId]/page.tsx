import { notFound, redirect } from "next/navigation";
import { requirePermission } from "@/features/permissions/server";
import {
  AuditService,
  voucherHistoryParamsSchema,
} from "@/features/audit/server";
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
      <div>
        <h1 className="text-3xl font-bold">
          Auditoría · {entityType} · {entityId}
        </h1>
        <p className="mt-1 text-gray-500">Historial completo del comprobante</p>
      </div>

      <AuditDetailTimeline events={serialisedEvents} />
    </div>
  );
}
