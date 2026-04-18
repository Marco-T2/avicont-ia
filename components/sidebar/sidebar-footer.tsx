"use client";

/**
 * PR3.4 [GREEN] — REQ-MS.9 (footer): Org-level Configuración link.
 *
 * Design decision (locked in design.md → "File Changes"):
 * The footer is ORG-LEVEL, not module-scoped, and NOT gated by a resource.
 * Configuración (settings hub) must remain reachable regardless of active
 * module or RBAC — the settings page itself enforces fine-grained access
 * server-side via requirePermission.
 *
 * Uses <NavItem> for visual consistency (icon, collapsed-mode tooltip,
 * active-route highlighting).
 */

import { Settings } from "lucide-react";
import { NavItem } from "./nav-item";

interface SidebarFooterProps {
  /** Current org slug — used to build the settings href */
  orgSlug: string;
}

export function SidebarFooter({ orgSlug }: SidebarFooterProps) {
  return (
    <div className="border-t px-3 py-3">
      <NavItem
        icon={<Settings className="h-5 w-5" />}
        label="Configuración"
        href={`/${orgSlug}/settings`}
      />
    </div>
  );
}
