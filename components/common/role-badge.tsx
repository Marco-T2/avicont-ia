"use client";

import { Badge } from "@/components/ui/badge";
import { useOrgRole } from "./use-org-role";
import type { Role } from "@/features/shared/permissions";

const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  admin: "Admin",
  contador: "Contador",
  cobrador: "Cobrador",
  auxiliar: "Auxiliar",
  member: "Miembro",
};

const ROLE_CLASSES: Record<Role, string> = {
  owner: "bg-purple-100 text-purple-800 border-purple-200",
  admin: "bg-blue-100 text-blue-800 border-blue-200",
  contador: "bg-emerald-100 text-emerald-800 border-emerald-200",
  cobrador: "bg-amber-100 text-amber-800 border-amber-200",
  auxiliar: "bg-orange-100 text-orange-800 border-orange-200",
  member: "bg-gray-100 text-gray-700 border-gray-200",
};

export function RoleBadge() {
  const { role, isLoading } = useOrgRole();
  if (isLoading || !role) return null;

  return (
    <Badge
      variant="outline"
      className={ROLE_CLASSES[role]}
      data-testid="role-badge"
    >
      {ROLE_LABELS[role]}
    </Badge>
  );
}
