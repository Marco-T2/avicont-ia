import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/features/permissions/server";
import { makeOperationalDocTypeService } from "@/modules/operational-doc-type/presentation/server";
import { Button } from "@/components/ui/button";
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

  const service = makeOperationalDocTypeService();
  const [activeTypes, inactiveTypes] = await Promise.all([
    service.list(orgId, { isActive: true }).then((entities) => entities.map((d) => d.toSnapshot())),
    service.list(orgId, { isActive: false }).then((entities) => entities.map((d) => d.toSnapshot())),
  ]);
  const docTypes = [...activeTypes, ...inactiveTypes].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  return (
    <div className="space-y-6">
      <Link href={`/${orgSlug}/settings`}>
        <Button variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Volver a Configuración
        </Button>
      </Link>

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
