import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requirePermission } from "@/features/shared/permissions.server";
import { RolesPermissionsMatrix } from "@/components/settings/roles-permissions-matrix";

interface RolesPageProps {
  params: Promise<{ orgSlug: string }>;
}

export const metadata: Metadata = {
  title: "Roles y Permisos",
};

export default async function RolesPage({ params }: RolesPageProps) {
  const { orgSlug } = await params;

  try {
    await requirePermission("accounting-config", "read", orgSlug);
  } catch {
    redirect(`/${orgSlug}`);
    return;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Roles y Permisos</h1>
        <p className="text-gray-500 mt-1">
          Vista de la matriz de permisos por rol. Para cambiar el rol de un miembro, vení a <span className="font-medium">Miembros</span>.
        </p>
      </div>

      <RolesPermissionsMatrix />
    </div>
  );
}
