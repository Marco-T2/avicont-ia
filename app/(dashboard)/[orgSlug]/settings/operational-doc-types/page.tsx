import { redirect } from "next/navigation";
import { requireAuth, requireOrgAccess } from "@/features/shared";
import { OperationalDocTypesService } from "@/features/operational-doc-types";
import OperationalDocTypesManager from "@/components/settings/operational-doc-types-manager";

interface OperationalDocTypesPageProps {
  params: Promise<{ orgSlug: string }>;
}

export default async function OperationalDocTypesPage({
  params,
}: OperationalDocTypesPageProps) {
  const { orgSlug } = await params;

  let userId: string;
  try {
    const session = await requireAuth();
    userId = session.userId;
  } catch {
    redirect("/sign-in");
  }

  let orgId: string;
  try {
    orgId = await requireOrgAccess(userId, orgSlug);
  } catch {
    redirect("/select-org");
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
        <p className="text-gray-500 mt-1">
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
