import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requirePermission } from "@/features/permissions/server";
import { RolesService, RolesRepository } from "@/features/organizations/server";
import RolesListClient from "@/components/settings/roles-list-client";
import type { CustomRoleShape } from "@/components/settings/role-edit-drawer";

interface RolesPageProps {
  params: Promise<{ orgSlug: string }>;
}

export const metadata: Metadata = {
  title: "Roles y Permisos",
};

const service = new RolesService({
  repo: new RolesRepository(),
  getCallerRoleSlug: async () => null,
});

export default async function RolesPage({ params }: RolesPageProps) {
  const { orgSlug } = await params;

  let orgId: string;
  try {
    const result = await requirePermission("accounting-config", "read", orgSlug);
    orgId = result.orgId;
  } catch {
    redirect(`/${orgSlug}`);
    return;
  }

  const rawRoles = await service.listRoles(orgId);

  // Map Prisma shape to CustomRoleShape for the client component
  const roles: CustomRoleShape[] = rawRoles.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    isSystem: r.isSystem,
    permissionsRead: r.permissionsRead,
    permissionsWrite: r.permissionsWrite,
    canPost: r.canPost,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Roles y Permisos</h1>
        <p className="text-muted-foreground mt-1">
          Gestioná los roles de tu organización. Los roles del sistema no se pueden modificar.
        </p>
      </div>

      <RolesListClient orgSlug={orgSlug} initialRoles={roles} />
    </div>
  );
}
