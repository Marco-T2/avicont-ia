import { redirect } from "next/navigation";
import { requirePermission } from "@/features/permissions/server";
import { OperationalDocTypesService } from "@/features/operational-doc-types/server";
import OperationalDocTypesManager from "@/components/settings/operational-doc-types-manager";

interface OperationalDocTypesPageProps {
  params: Promise<{ orgSlug: string }>;
}

export default async function OperationalDocTypesPage({
  params,
}: OperationalDocTypesPageProps) {
  const { orgSlug } = await params;

  let orgId: string;
  try {
    const result = await requirePermission("accounting-config", "write", orgSlug);
    orgId = result.orgId;
  } catch {
    redirect(`/${orgSlug}`);
  }

  const service = new OperationalDocTypesService();
  const [activeTypes, inactiveTypes] = await Promise.all([
    service.list(orgId, { isActive: true }),
    service.list(orgId, { isActive: false }),
  ]);
  const docTypes = [...activeTypes, ...inactiveTypes].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Tipos de Documento Operativo</h1>
        <p className="text-muted-foreground mt-1">
          Administra los talonarios utilizados en cobros y pagos
        </p>
      </div>
      <OperationalDocTypesManager
        orgSlug={orgSlug}
        initialDocTypes={JSON.parse(JSON.stringify(docTypes))}
      />
    </div>
  );
}
