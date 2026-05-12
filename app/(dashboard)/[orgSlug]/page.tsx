import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { makeOrganizationsService } from "@/modules/organizations/presentation/server";
import { buildClientMatrixSnapshot } from "@/features/permissions/server";
import { getRoleDefaultModuleFromSnapshot } from "@/components/sidebar/modules/get-role-default-module";
import { MODULES } from "@/components/sidebar/modules/registry";

const orgService = makeOrganizationsService();

interface OrgDashboardPageProps {
  params: Promise<{ orgSlug: string }>;
}

export default async function OrgDashboardPage({
  params,
}: OrgDashboardPageProps) {
  const { orgSlug } = await params;
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  let organization, membership;
  try {
    ({ organization, membership } = await orgService.getOrgLayoutData(
      orgSlug,
      userId,
    ));
  } catch {
    redirect("/select-org");
  }

  const snapshot = await buildClientMatrixSnapshot(
    organization.id,
    membership.role,
  );

  const moduleId = getRoleDefaultModuleFromSnapshot(snapshot);
  const mod = MODULES.find((m) => m.id === moduleId);

  if (mod) {
    redirect(mod.homeRoute(orgSlug));
  }

  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="text-2xl font-semibold">Sin permisos asignados</h1>
      <p className="text-muted-foreground mt-2">
        Tu cuenta no tiene acceso a ningún módulo en{" "}
        <span className="font-medium">{organization.name}</span>. Contactá al
        administrador de la organización para que te asigne permisos.
      </p>
    </div>
  );
}
