"use client";

/**
 * PR3.2 [GREEN] — REQ-MS.9: CrossModuleNav — persistent cross-module section.
 *
 * Renders three fixed entries regardless of the active module:
 *   - Agente IA  (action button — opens chat drawer, NOT a navigation link)
 *   - Miembros   (link → /{orgSlug}/members)
 *   - Documentos (link → /{orgSlug}/documents)
 *
 * Each is individually gated by `matrix.canAccess(resource, "read")`:
 *   - Agente IA  → "agent"
 *   - Miembros   → "members"
 *   - Documentos → "documents"
 *
 * Design notes:
 * - `onOpenAgentChat` is threaded through from <AppSidebar> — Agente IA
 *   stays an action button, not a link, preserving pre-PR3 semantics.
 * - Uses the existing <NavItem> primitive to match the rest of the sidebar's
 *   look & feel (icons, collapsed-mode tooltips, active-route highlighting).
 */

import { Bot, FileText, Users } from "lucide-react";
import { useRolesMatrix } from "@/components/common/roles-matrix-provider";
import type { Resource } from "@/features/shared/permissions";
import { NavItem } from "./nav-item";

interface CrossModuleNavProps {
  /** Current org slug — used to build hrefs for Miembros and Documentos */
  orgSlug: string;
  /** Callback to open the Agente IA chat drawer */
  onOpenAgentChat: () => void;
}

interface CrossModuleEntry {
  icon: React.ReactNode;
  label: string;
  resource: Resource;
  /** Exactly one of `href` or `onClick` is set */
  href?: string;
  onClick?: () => void;
}

export function CrossModuleNav({ orgSlug, onOpenAgentChat }: CrossModuleNavProps) {
  const matrix = useRolesMatrix();

  const entries: CrossModuleEntry[] = [
    {
      icon: <Bot className="h-5 w-5" />,
      label: "Agente IA",
      resource: "agent",
      onClick: onOpenAgentChat,
    },
    {
      icon: <Users className="h-5 w-5" />,
      label: "Miembros",
      resource: "members",
      href: `/${orgSlug}/members`,
    },
    {
      icon: <FileText className="h-5 w-5" />,
      label: "Documentos",
      resource: "documents",
      href: `/${orgSlug}/documents`,
    },
  ];

  const visible = entries.filter((entry) => {
    if (!matrix) return false;
    return matrix.canAccess(entry.resource, "read");
  });

  if (visible.length === 0) return null;

  return (
    <nav aria-label="Navegación compartida" className="flex flex-col gap-1">
      {visible.map((entry) => (
        <NavItem
          key={entry.label}
          icon={entry.icon}
          label={entry.label}
          href={entry.href}
          onClick={entry.onClick}
        />
      ))}
    </nav>
  );
}
