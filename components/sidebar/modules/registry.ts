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
 */

import type { ReactNode } from "react";
import type { Resource } from "@/features/shared/permissions";

export type ModuleId = "contabilidad" | "granjas";

export interface ModuleNavItem {
  label: string;
  href?: (orgSlug: string) => string;
  resource?: Resource;
  children?: ModuleNavItem[];
  isSeparator?: boolean;
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
      // --- Separator: Operaciones ---
      { label: "Operaciones", isSeparator: true },
      {
        label: "Ventas y Despachos",
        href: (orgSlug) => `/${orgSlug}/dispatches`,
        resource: "dispatches",
      },
      {
        label: "Compras y Servicios",
        href: (orgSlug) => `/${orgSlug}/purchases`,
        resource: "purchases",
      },
      {
        label: "Cobros y Pagos",
        href: (orgSlug) => `/${orgSlug}/payments`,
        resource: "payments",
      },
      {
        label: "Cuentas por Cobrar",
        href: (orgSlug) => `/${orgSlug}/accounting/cxc`,
        resource: "sales",
      },
      {
        label: "Cuentas por Pagar",
        href: (orgSlug) => `/${orgSlug}/accounting/cxp`,
        resource: "purchases",
      },
      // --- Separator: Contabilidad ---
      { label: "Contabilidad", isSeparator: true },
      {
        label: "Plan de Cuentas",
        href: (orgSlug) => `/${orgSlug}/accounting/accounts`,
        resource: "accounting-config",
      },
      {
        label: "Libro Diario",
        href: (orgSlug) => `/${orgSlug}/accounting/journal`,
        resource: "journal",
      },
      {
        label: "Libro Mayor",
        href: (orgSlug) => `/${orgSlug}/accounting/ledger`,
        resource: "journal",
      },
      {
        label: "Contactos",
        href: (orgSlug) => `/${orgSlug}/accounting/contacts`,
        resource: "contacts",
      },
      {
        label: "Informes",
        href: (orgSlug) => `/${orgSlug}/informes`,
        resource: "reports",
      },
      {
        label: "Cierre Mensual",
        href: (orgSlug) => `/${orgSlug}/accounting/monthly-close`,
        resource: "journal",
      },
      // PR4.9: "Configuración" intentionally NOT in Contabilidad's navItems.
      // SidebarFooter is the canonical, org-level home for this link.
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
      },
    ],
  },
];
