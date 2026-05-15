/**
 * PR1.2 [GREEN] — REQ-MS.1: Module registry — types + data.
 *
 * Declarative module registry for the Sidebar Module Switcher.
 * Single file for current 2-module scope; extract to per-module files when ≥4.
 *
 * Design decisions:
 * - ModuleId is a union type (not enum) for lightweight tree-shaking
 * - homeRoute is a function, not a string, to avoid baking orgSlug at import time
 * - isSeparator navItems carry a label for section headings (matches NavSubItem)
 * - icon uses React.ReactNode to stay framework-agnostic at the type level
 *
 * C1 sidebar-reorg-settings-hub: Contabilidad trimmed to 8 flat leaves
 * (zero separators). Plan de Cuentas + Cierre Mensual moved to /settings
 * hub cards (C3); Cuentas por Cobrar + Cuentas por Pagar moved to /informes
 * catalog entries (C0).
 */

import type { ReactNode } from "react";
import type { Resource } from "@/features/permissions";

export type ModuleId = "contabilidad" | "granjas";

/**
 * Stable identifiers for nav-item icons. Mapped to ReactNode in
 * `active-module-nav.tsx` (registry stays JSX-free per PR1.2).
 * Add a new key here when you add a navItem; keep them kebab-case and
 * label-derived so the mapping survives label edits.
 */
export type NavIconKey =
  | "inicio"
  | "ventas-despachos"
  | "compras-servicios"
  | "cobros-pagos"
  | "libro-diario"
  | "libro-mayor"
  | "contactos"
  | "informes"
  | "mis-granjas";

export interface ModuleNavItem {
  label: string;
  href?: (orgSlug: string) => string;
  resource?: Resource;
  children?: ModuleNavItem[];
  isSeparator?: boolean;
  iconKey?: NavIconKey;
}

export interface Module {
  id: ModuleId;
  label: string;
  icon: ReactNode;
  resources: Resource[];
  homeRoute: (orgSlug: string) => string;
  navItems: ModuleNavItem[];
}

export const MODULES: Module[] = [
  {
    id: "contabilidad",
    label: "Contabilidad",
    // Icon is resolved at render time by consumers — stored as null here
    // (registry is a pure data module, no React import needed).
    // Components that render modules supply the icon from their own import.
    icon: null,
    resources: [
      "journal",
      "sales",
      "purchases",
      "payments",
      "dispatches",
      "reports",
      "contacts",
      "accounting-config",
    ],
    homeRoute: (orgSlug: string) => `/${orgSlug}/accounting`,
    navItems: [
      {
        label: "Inicio",
        href: (orgSlug) => `/${orgSlug}/accounting`,
        iconKey: "inicio",
      },
      {
        label: "Ventas",
        href: (orgSlug) => `/${orgSlug}/sales`,
        resource: "sales",
        iconKey: "ventas-despachos",
      },
      {
        label: "Compras",
        href: (orgSlug) => `/${orgSlug}/purchases`,
        resource: "purchases",
        iconKey: "compras-servicios",
      },
      {
        label: "Cobros y Pagos",
        href: (orgSlug) => `/${orgSlug}/payments`,
        resource: "payments",
        iconKey: "cobros-pagos",
      },
      {
        label: "Libro Diario",
        href: (orgSlug) => `/${orgSlug}/accounting/journal`,
        resource: "journal",
        iconKey: "libro-diario",
      },
      {
        label: "Libro Mayor",
        href: (orgSlug) => `/${orgSlug}/accounting/ledger`,
        resource: "journal",
        iconKey: "libro-mayor",
      },
      {
        label: "Contactos",
        href: (orgSlug) => `/${orgSlug}/accounting/contacts`,
        resource: "contacts",
        iconKey: "contactos",
      },
      {
        label: "Informes",
        href: (orgSlug) => `/${orgSlug}/informes`,
        resource: "reports",
        iconKey: "informes",
      },
      // PR4.9: "Configuración" intentionally NOT in Contabilidad's navItems.
      // SidebarFooter is the canonical, org-level home for this link.
      // C1 sidebar-reorg-settings-hub: Plan de Cuentas, Cierre Mensual,
      // Cuentas por Cobrar y Cuentas por Pagar removed — absorbed by
      // Settings hub cards (C3) and Informes catalog (C0).
    ],
  },
  {
    id: "granjas",
    label: "Granjas",
    icon: null,
    resources: ["farms"],
    homeRoute: (orgSlug: string) => `/${orgSlug}/farms`,
    navItems: [
      {
        label: "Mis Granjas",
        href: (orgSlug) => `/${orgSlug}/farms`,
        resource: "farms",
        iconKey: "mis-granjas",
      },
    ],
  },
];
