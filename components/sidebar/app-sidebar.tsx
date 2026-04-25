"use client";

/**
 * PR3.8 [GREEN] — REQ-MS.9 + REQ-MS.16: AppSidebar composition refactor.
 *
 * Pre-PR3 shape: a flat `navItems[]` array with a parent-level RBAC filter
 * (by resource) rendered inline via <NavItem> children.
 *
 * Post-PR3 shape: a composition of small, focused sub-components driven by
 * the module registry + useActiveModule() hook:
 *   - <ModuleSwitcher />      (PR2) — module picker (active + available)
 *   - <ActiveModuleNav />     (PR3) — active module's navItems (hrefs pre-resolved)
 *   - <CrossModuleNav />      (PR3) — Agente IA / Miembros / Documentos
 *   - <SidebarFooter />       (PR3) — Configuración link (org-level)
 *
 * Notes:
 * - orgSlug is sourced from useParams() once and passed to all children.
 * - useActiveModule() derives the current module from the route / localStorage
 *   / role default — no module state lives in <AppSidebar>.
 * - Per-child RBAC filter is PR4's job; PR3 renders navItems as-is.
 * - No `app/` route files are imported or touched — REQ-MS.16 preserved.
 * - sidebar-provider.tsx is NOT modified — it continues to own collapse /
 *   mobile UI state only.
 */

import { useParams } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebar } from "./sidebar-provider";
import { ModuleSwitcher } from "./module-switcher";
import { ActiveModuleNav } from "./active-module-nav";
import { CrossModuleNav } from "./cross-module-nav";
import { SidebarFooter } from "./sidebar-footer";
import { useActiveModule } from "./modules/use-active-module";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { TooltipProvider } from "@/components/ui/tooltip";

interface AppSidebarProps {
  onOpenAgentChat: () => void;
}

export function AppSidebar({ onOpenAgentChat }: AppSidebarProps) {
  const { isCollapsed, toggleSidebar, isMobileOpen, toggleMobile } =
    useSidebar();
  const params = useParams();
  const orgSlug = params?.orgSlug as string;
  const { activeModule } = useActiveModule();

  const sidebarContent = (
    <TooltipProvider>
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between px-3 pt-4 pb-2">
          {!isCollapsed && (
            <span className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
              Menú
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className={cn("h-7 w-7", isCollapsed && "mx-auto")}
          >
            {isCollapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </Button>
        </div>
        <ScrollArea className="flex-1 px-3">
          <div className="mb-2 pt-1">
            <ModuleSwitcher isCollapsed={isCollapsed} isMobile={isMobileOpen} />
          </div>
          <ActiveModuleNav module={activeModule} orgSlug={orgSlug} />
          {/* Visual boundary between module-scoped nav and cross-module nav */}
          <div className="my-3 h-px bg-border/60" />
          <CrossModuleNav orgSlug={orgSlug} onOpenAgentChat={onOpenAgentChat} />
        </ScrollArea>
        <SidebarFooter orgSlug={orgSlug} />
      </div>
    </TooltipProvider>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden md:flex h-full flex-col border-r bg-sidebar transition-all duration-200",
          isCollapsed ? "w-16" : "w-64",
        )}
      >
        {sidebarContent}
      </aside>

      {/* Mobile sidebar (Sheet) */}
      <Sheet open={isMobileOpen} onOpenChange={toggleMobile}>
        <SheetContent side="left" className="w-64 p-0">
          <SheetHeader className="px-4 pt-4">
            <SheetTitle>Menu</SheetTitle>
          </SheetHeader>
          {sidebarContent}
        </SheetContent>
      </Sheet>
    </>
  );
}
