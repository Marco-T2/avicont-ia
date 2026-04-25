import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/features/permissions/server";
import { AuditService, parseCursor } from "@/features/audit/server";
import type {
  AuditAction,
  AuditCursor,
  AuditEntityType,
} from "@/features/audit";
import { AUDIT_ACTIONS, AUDITED_ENTITY_TYPES } from "@/features/audit";
import { AuditEventList } from "@/components/audit/audit-event-list";
import { endOfMonth, startOfMonth } from "@/lib/date-utils";

interface AuditPageProps {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

function pickString(v: string | string[] | undefined): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async function AuditPage({
  params,
  searchParams,
}: AuditPageProps) {
  const { orgSlug } = await params;
  const sp = await searchParams;

  let orgId: string;
  try {
    ({ orgId } = await requirePermission("audit", "read", orgSlug));
  } catch {
    redirect(`/${orgSlug}`);
  }

  // Resolver filtros desde URL, con default mes-en-curso si ambas fechas ausentes.
  const rawFrom = pickString(sp.dateFrom);
  const rawTo = pickString(sp.dateTo);
  const now = new Date();
  const dateFrom = rawFrom ? new Date(rawFrom) : startOfMonth(now);
  const dateTo = rawTo ? new Date(rawTo) : endOfMonth(now);

  const entityType = pickString(sp.entityType) as AuditEntityType | undefined;
  const changedById = pickString(sp.changedById);
  const action = pickString(sp.action) as AuditAction | undefined;
  const rawCursor = pickString(sp.cursor);

  let cursor: AuditCursor | undefined;
  if (rawCursor) {
    try {
      cursor = parseCursor(rawCursor);
    } catch {
      // Cursor inválido → ignorar, la lista arranca de cero. No crash.
      cursor = undefined;
    }
  }

  const entityTypeSafe =
    entityType && (AUDITED_ENTITY_TYPES as readonly string[]).includes(entityType)
      ? entityType
      : undefined;
  const actionSafe =
    action && (AUDIT_ACTIONS as readonly string[]).includes(action)
      ? action
      : undefined;

  const result = await new AuditService().listGrouped(orgId, {
    dateFrom,
    dateTo,
    entityType: entityTypeSafe,
    changedById,
    action: actionSafe,
    cursor,
    limit: 50,
  });

  // Serializar Dates para el client component (Next.js requirement).
  const initialData = JSON.parse(JSON.stringify(result)) as typeof result;

  // Resolver lista de usuarios activos de la org para el filter select.
  const members = await prisma.organizationMember.findMany({
    where: { organizationId: orgId, deactivatedAt: null },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { user: { name: "asc" } },
  });
  const users = members.map((m) => ({
    id: m.user.id,
    name: m.user.name ?? m.user.email,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Auditoría</h1>
        <p className="mt-1 text-muted-foreground">
          Historial de cambios agrupado por comprobante
        </p>
      </div>

      <AuditEventList
        orgSlug={orgSlug}
        initialData={initialData}
        filters={{
          dateFrom: toIsoDate(dateFrom),
          dateTo: toIsoDate(dateTo),
          entityType: entityTypeSafe,
          changedById,
          action: actionSafe,
          cursor: rawCursor,
        }}
        users={users}
      />
    </div>
  );
}
