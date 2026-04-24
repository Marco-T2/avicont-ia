import { redirect } from "next/navigation";
import { requirePermission } from "@/features/permissions/server";
import { prisma } from "@/lib/prisma";

interface CloseEventPageProps {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ correlationId?: string }>;
}

const formatter = new Intl.DateTimeFormat("es-BO", {
  timeZone: "America/La_Paz",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

const ENTITY_LABELS: Record<string, string> = {
  fiscal_periods: "Períodos Fiscales",
  dispatches: "Despachos",
  payments: "Cobros y Pagos",
  journal_entries: "Asientos Contables",
  purchases: "Compras",
  sales: "Ventas",
};

export default async function CloseEventPage({
  params,
  searchParams,
}: CloseEventPageProps) {
  const { orgSlug } = await params;
  const { correlationId } = await searchParams;

  let orgId: string;
  try {
    const result = await requirePermission("period", "read", orgSlug);
    orgId = result.orgId;
  } catch {
    redirect(`/${orgSlug}`);
  }

  if (!correlationId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Evento de Cierre</h1>
          <p className="text-gray-500 mt-1">No se especificó un evento de cierre.</p>
        </div>
      </div>
    );
  }

  const rows = await prisma.auditLog.findMany({
    where: { organizationId: orgId, correlationId },
    orderBy: [{ entityType: "asc" }, { createdAt: "asc" }],
  });

  // Group by entityType
  const grouped = rows.reduce<Record<string, typeof rows>>((acc, row) => {
    if (!acc[row.entityType]) acc[row.entityType] = [];
    acc[row.entityType].push(row);
    return acc;
  }, {});

  const entityTypes = Object.keys(grouped).sort();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Evento de Cierre</h1>
        <p className="text-gray-500 mt-1">
          Registro de auditoría del cierre de período
        </p>
      </div>

      {entityTypes.length === 0 ? (
        <p className="text-muted-foreground">No hay registros para este evento.</p>
      ) : (
        entityTypes.map((entityType) => (
          <section key={entityType} aria-label={entityType}>
            <h2 className="text-lg font-semibold mb-2">
              {ENTITY_LABELS[entityType] ?? entityType}
            </h2>
            <ul className="space-y-1 border rounded-md divide-y">
              {grouped[entityType].map((row) => (
                <li key={row.id} className="px-4 py-2 text-sm">
                  {row.action} —{" "}
                  {formatter.format(new Date(row.createdAt))}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
