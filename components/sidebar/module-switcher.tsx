"use client";

/**
 * PR2.2 [GREEN] — REQ-MS.2: ModuleSwitcher component — DropdownMenu-based.
 * PR2.4 [GREEN] — REQ-MS.5: onClick → setActiveModule + localStorage + router.push
 * PR2.6 [GREEN] — REQ-MS.13: isCollapsed prop → icon button + Tooltip
 * PR2.8 [GREEN] — REQ-MS.12: isMobile prop → native <select>
 *
 * Design decisions (from design.md):
 * - DropdownMenu replaces Popover (Popover doesn't exist in components/ui/)
 * - Mobile: native <select> for OS picker UX (REQ-MS.12)
 * - Collapsed: icon button + Tooltip wrapping the DropdownMenuTrigger (REQ-MS.13)
 * - visibleModules = MODULES.filter(m => m.resources.some(r => matrix?.canAccess(r,"read") ?? false))
 * - orgSlug sourced from useParams() — same pattern as app-sidebar.tsx
 * - Mobile detection: isMobile prop (passed from app-sidebar which reads isMobileOpen from useSidebar)
 *   This is consistent with the existing app-sidebar.tsx pattern of checking isMobileOpen.
 */

import { useParams, useRouter } from "next/navigation";
import { useRolesMatrix } from "@/components/common/roles-matrix-provider";
import { useActiveModule } from "./modules/use-active-module";
import { MODULES } from "./modules/registry";
import type { ModuleId } from "./modules/registry";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Calculator, Tractor } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

// ---------------------------------------------------------------------------
// Module icon mapping — registry stores icon: null (pure data module);
// ModuleSwitcher resolves the visual icon from its own icon map.
// ---------------------------------------------------------------------------

const MODULE_ICONS: Record<ModuleId, ReactNode> = {
  contabilidad: <Calculator className="h-5 w-5" />,
  granjas: <Tractor className="h-5 w-5" />,
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ModuleSwitcherProps {
  /** Collapsed (desktop narrow) mode: show icon + tooltip only */
  isCollapsed?: boolean;
  /** Mobile mode: render native <select> instead of DropdownMenu */
  isMobile?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ModuleSwitcher({ isCollapsed = false, isMobile = false }: ModuleSwitcherProps) {
  const matrix = useRolesMatrix();
  const { activeModule, setActiveModule } = useActiveModule();
  const router = useRouter();
  const params = useParams();
  const orgSlug = params?.orgSlug as string;

  // REQ-MS.2: visible modules = those where at least one resource is accessible
  const visibleModules = MODULES.filter((m) =>
    m.resources.some((r) => matrix?.canAccess(r, "read") ?? false)
  );

  // Handler: select a module → persist + navigate (REQ-MS.5)
  function handleSelect(id: ModuleId) {
    const mod = MODULES.find((m) => m.id === id);
    if (!mod) return;
    setActiveModule(id);
    localStorage.setItem("sidebar-active-module", id);
    router.push(mod.homeRoute(orgSlug));
  }

  // REQ-MS.12: Mobile mode — native <select>
  if (isMobile) {
    return (
      <select
        value={activeModule?.id ?? ""}
        onChange={(e) => handleSelect(e.target.value as ModuleId)}
        aria-label="Módulo activo"
        className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
      >
        {visibleModules.map((mod) => (
          <option key={mod.id} value={mod.id}>
            {mod.label}
          </option>
        ))}
      </select>
    );
  }

  // The dropdown items are shared between collapsed and expanded render paths
  const dropdownItems = visibleModules.map((mod) => (
    <DropdownMenuItem key={mod.id} onClick={() => handleSelect(mod.id)}>
      <span className="mr-2">{MODULE_ICONS[mod.id]}</span>
      {mod.label}
    </DropdownMenuItem>
  ));

  // REQ-MS.13: Collapsed mode — icon button + tooltip wrapping the trigger
  if (isCollapsed) {
    const icon = activeModule ? MODULE_ICONS[activeModule.id] : null;
    const label = activeModule?.label ?? "Módulo";

    return (
      <TooltipProvider>
        <Tooltip>
          <DropdownMenu>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={label}
                  data-module-label={label}
                  className="mx-auto"
                >
                  {icon}
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="right">{label}</TooltipContent>
            <DropdownMenuContent side="right" align="start">
              {dropdownItems}
            </DropdownMenuContent>
          </DropdownMenu>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Default: expanded desktop mode
  const icon = activeModule ? MODULE_ICONS[activeModule.id] : null;
  const label = activeModule?.label ?? "Seleccionar módulo";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="w-full justify-start gap-2 px-2">
          {icon}
          <span>{label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {dropdownItems}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
