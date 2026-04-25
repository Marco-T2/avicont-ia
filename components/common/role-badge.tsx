"use client";

import { Badge } from "@/components/ui/badge";
import { useOrgRole } from "./use-org-role";
import type { Role } from "@/features/permissions";

const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  admin: "Admin",
  contador: "Contador",
  cobrador: "Cobrador",
  member: "Miembro",
};

const ROLE_CLASSES: Record<Role, string> = {
  owner:
    "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/40 dark:text-purple-200 dark:border-purple-800/50",
  admin:
    "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/40 dark:text-blue-200 dark:border-blue-800/50",
  contador:
    "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-200 dark:border-emerald-800/50",
  cobrador:
    "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-800/50",
  member: "bg-muted text-muted-foreground border-border",
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
