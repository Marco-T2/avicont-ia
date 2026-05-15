"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import RoleCreateDialog from "./role-create-dialog";
import RoleEditDrawer from "./role-edit-drawer";
import type { CustomRoleShape } from "./role-edit-drawer";
import RoleDeleteDialog from "./role-delete-dialog";

interface RolesListClientProps {
  orgSlug: string;
  initialRoles: CustomRoleShape[];
}

/**
 * RolesListClient — full list view of org roles.
 *
 * PR7.5 / REQ CR.2-S3, U.5-S1, U.5-S2, U.5-S4
 * - system roles: read-only rows (no Edit/Delete buttons)
 * - custom roles: rows with Edit (RoleEditDrawer) + Delete (RoleDeleteDialog)
 * - "Create role" button triggers RoleCreateDialog
 */
export default function RolesListClient({
  orgSlug,
  initialRoles,
}: RolesListClientProps) {
  const router = useRouter();
  const [roles, setRoles] = useState<CustomRoleShape[]>(initialRoles);

  // W-1 fix: sync local state when server re-renders with updated initialRoles
  // (happens after router.refresh() causes Next.js to re-fetch server data)
  useEffect(() => {
    setRoles(initialRoles);
  }, [initialRoles]);

  function handleRefresh() {
    router.refresh();
    // Optimistically trigger a re-render via server revalidation
    // The router.refresh() will cause Next to re-fetch server data
    // and re-render with updated roles list.
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Roles</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Los roles del sistema no se pueden modificar.
          </p>
        </div>
        <RoleCreateDialog orgSlug={orgSlug} onCreated={handleRefresh} />
      </div>

      {/* Roles table */}
      <div className="border rounded-md divide-y">
        {roles.map((role) => (
          <div
            key={role.slug}
            className="flex items-center justify-between px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <div>
                <p className="font-medium text-sm">{role.name}</p>
                <p className="text-xs text-muted-foreground font-mono">{role.slug}</p>
              </div>
              {role.isSystem && (
                <Badge variant="outline" className="text-xs">
                  Sistema
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2">
              <RoleEditDrawer
                orgSlug={orgSlug}
                role={role}
                onUpdated={handleRefresh}
              />
              {!role.isSystem && (
                <RoleDeleteDialog
                  orgSlug={orgSlug}
                  roleSlug={role.slug}
                  roleName={role.name}
                  onDeleted={handleRefresh}
                />
              )}
            </div>
          </div>
        ))}

        {roles.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No hay roles configurados.
          </div>
        )}
      </div>
    </div>
  );
}
