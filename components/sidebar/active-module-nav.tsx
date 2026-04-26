"use client";

/**
 * PR4.2 [GREEN] — REQ-MS.7: Per-child RBAC filter.
 *
 * Previous (PR3.6) behaviour: render every navItem in the active module,
 * no RBAC gate at the child level.
 *
 * PR4 behaviour:
 *   - Each navItem with a `resource` is filtered via
 *     `matrix.canAccess(resource, "read")`. Null matrix → deny by default.
 *   - Items WITHOUT a resource (e.g., separators, placeholder-label items)
 *     are always visible.
 *   - Empty-parent rule (PR4.4): if the filter removes ALL items so the
 *     module has zero visible children, `<ActiveModuleNav>` renders null.
 *   - Separator-hiding (PR4.6): a separator between two filtered-out items
 *     (no surviving child after it before the next separator or end-of-list)
 *     is also hidden.
 *
 * Design notes preserved from PR3:
 * - Receives `module: Module | null` + `orgSlug: string`.
 * - Pre-resolves each navItem's `href(orgSlug)` into a static string HERE,
 *   at the parent level, so the existing <NavItem> primitive keeps its
 *   static-string API untouched.
 * - navItems in the registry are FLAT leaf entries (no nested children at
 *   this layer). Separators are rendered inline as section headings,
 *   non-separator items as links via <NavItem>.
 * - Null module OR empty navItems → renders nothing (no empty nav shell).
 */

import {
  ArrowLeftRight,
  BarChart3,
  BookOpen,
  CalendarCheck,
  Contact,
  FolderTree,
  HandCoins,
  Home,
  Library,
  Receipt,
  ShoppingBag,
  ShoppingCart,
  Warehouse,
} from "lucide-react";
import type { ReactNode } from "react";
import { NavItem } from "./nav-item";
import { useSidebar } from "./sidebar-provider";
import type { Module, ModuleNavItem, NavIconKey } from "./modules/registry";
import { useRolesMatrix } from "@/components/common/roles-matrix-provider";
import type { ClientMatrix } from "@/components/common/roles-matrix-provider";
import { dropOrphanSeparators } from "@/lib/sidebar/drop-orphan-separators";

const NAV_ICONS: Record<NavIconKey, ReactNode> = {
  inicio: <Home className="h-5 w-5" />,
  "ventas-despachos": <ShoppingCart className="h-5 w-5" />,
  "compras-servicios": <ShoppingBag className="h-5 w-5" />,
  "cobros-pagos": <ArrowLeftRight className="h-5 w-5" />,
  "cuentas-cobrar": <HandCoins className="h-5 w-5" />,
  "cuentas-pagar": <Receipt className="h-5 w-5" />,
  "plan-cuentas": <FolderTree className="h-5 w-5" />,
  "libro-diario": <BookOpen className="h-5 w-5" />,
  "libro-mayor": <Library className="h-5 w-5" />,
  contactos: <Contact className="h-5 w-5" />,
  informes: <BarChart3 className="h-5 w-5" />,
  "cierre-mensual": <CalendarCheck className="h-5 w-5" />,
  "mis-granjas": <Warehouse className="h-5 w-5" />,
};

interface ActiveModuleNavProps {
  /** The active module; null renders nothing */
  module: Module | null;
  /** Current org slug — used to resolve each navItem's href function */
  orgSlug: string;
}

/**
 * PR4.2: Decide whether a leaf navItem is visible for the current matrix.
 * Items without a resource are always visible; items with a resource need
 * `matrix.canAccess(resource, "read")` to be true. Null matrix = deny.
 */
function isChildVisible(
  item: ModuleNavItem,
  matrix: ClientMatrix | null,
): boolean {
  if (item.isSeparator) return true; // separators handled in PR4.6 pass
  if (!item.resource) return true;
  if (!matrix) return false;
  return matrix.canAccess(item.resource, "read");
}


export function ActiveModuleNav({ module, orgSlug }: ActiveModuleNavProps) {
  const matrix = useRolesMatrix();
  const { isCollapsed } = useSidebar();

  if (!module) return null;
  if (module.navItems.length === 0) return null;

  // PR4.2: per-child RBAC filter
  const rbacFiltered = module.navItems.filter((item) =>
    isChildVisible(item, matrix),
  );

  // PR4.6: hide separators that would now be orphaned
  let visibleItems = dropOrphanSeparators(rbacFiltered);

  // Collapsed mode: separators would render as broken short text ("Oper",
  // "Cont") inside the w-16 rail. Drop them entirely — the gap between
  // grouped icons is visual separation enough.
  if (isCollapsed) {
    visibleItems = visibleItems.filter((item) => !item.isSeparator);
  }

  // PR4.4: empty-parent rule — no visible non-separator child → render null
  const hasVisibleChild = visibleItems.some((item) => !item.isSeparator);
  if (!hasVisibleChild) return null;

  return (
    <nav aria-label={module.label} className="flex flex-col gap-1">
      {visibleItems.map((item, index) => {
        if (item.isSeparator) {
          return (
            <div
              key={`sep-${index}-${item.label}`}
              className="mt-3 mb-1 px-3 flex items-center gap-2"
            >
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {item.label}
              </span>
              <div className="flex-1 h-px bg-border/60" />
            </div>
          );
        }

        // Pre-resolve href(orgSlug) → static string before passing to NavItem.
        const resolvedHref = item.href ? item.href(orgSlug) : undefined;
        const icon = item.iconKey ? NAV_ICONS[item.iconKey] : null;

        return (
          <NavItem
            key={`item-${index}-${item.label}`}
            icon={icon}
            label={item.label}
            href={resolvedHref}
          />
        );
      })}
    </nav>
  );
}
