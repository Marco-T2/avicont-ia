import {
  Settings,
  Calendar,
  Receipt,
  Package,
  FileText,
  Users,
  ShieldCheck,
  Building2,
  FolderTree,
  CalendarCheck,
  History,
  type LucideIcon,
} from "lucide-react";
import type { Resource } from "@/features/permissions";

/**
 * Card definition for the settings hub page.
 *
 * REQ-OP.8 originally introduced the "Perfil de Empresa" card. C3
 * sidebar-reorg-settings-hub adds three new cards — Plan de Cuentas,
 * Cierre Mensual, Auditoría — and adds optional `resource?: Resource`
 * for per-card RBAC filtering at the page route (`app/(dashboard)/[orgSlug]/settings/page.tsx`).
 *
 * Convention: `roles` shares the `members` resource gate (managing roles is
 * gated by members permission per Avicont RBAC). Cards without `resource`
 * fall through the filter (always visible).
 */
interface SettingsCard {
  id: string;
  title: string;
  description: string;
  href: (orgSlug: string) => string;
  Icon: LucideIcon;
  resource?: Resource;
}

export const SETTINGS_CARDS: SettingsCard[] = [
  {
    id: "general",
    title: "Configuración General",
    description: "Cuentas contables y parámetros de la organización",
    href: (orgSlug) => `/${orgSlug}/settings/general`,
    Icon: Settings,
    resource: "accounting-config",
  },
  {
    id: "periods",
    title: "Períodos Fiscales",
    description: "Apertura y cierre de períodos contables",
    href: (orgSlug) => `/${orgSlug}/settings/periods`,
    Icon: Calendar,
    resource: "accounting-config",
  },
  {
    id: "voucher-types",
    title: "Tipos de Comprobante",
    description: "Prefijos y correlativos de comprobantes",
    href: (orgSlug) => `/${orgSlug}/settings/voucher-types`,
    Icon: Receipt,
    resource: "accounting-config",
  },
  {
    id: "product-types",
    title: "Tipos de Producto",
    description: "Catálogo de productos y sus cuentas asociadas",
    href: (orgSlug) => `/${orgSlug}/settings/product-types`,
    Icon: Package,
    resource: "accounting-config",
  },
  {
    id: "operational-doc-types",
    title: "Tipos de Documento",
    description: "Documentos operativos (remitos, órdenes, etc.)",
    href: (orgSlug) => `/${orgSlug}/settings/operational-doc-types`,
    Icon: FileText,
    resource: "accounting-config",
  },
  {
    id: "members",
    title: "Miembros",
    description: "Invitaciones y asignación de roles por usuario",
    href: (orgSlug) => `/${orgSlug}/members`,
    Icon: Users,
    resource: "members",
  },
  {
    id: "roles",
    title: "Roles y Permisos",
    description: "Matriz de qué puede hacer cada rol en cada módulo",
    href: (orgSlug) => `/${orgSlug}/settings/roles`,
    Icon: ShieldCheck,
    resource: "members",
  },
  {
    id: "company",
    title: "Perfil de Empresa",
    description: "Identidad, logo y firmas por tipo de documento",
    href: (orgSlug) => `/${orgSlug}/settings/company`,
    Icon: Building2,
    resource: "accounting-config",
  },
  // C3 sidebar-reorg-settings-hub: 3 new cards absorbed from sidebar.
  {
    id: "plan-cuentas",
    title: "Plan de Cuentas",
    description: "Catálogo y estructura de cuentas contables.",
    href: (orgSlug) => `/${orgSlug}/accounting/accounts`,
    Icon: FolderTree,
    resource: "accounting-config",
  },
  {
    id: "monthly-close",
    title: "Cierre Mensual",
    description: "Cierre del período contable mes a mes.",
    href: (orgSlug) => `/${orgSlug}/accounting/monthly-close`,
    Icon: CalendarCheck,
    resource: "period",
  },
  {
    id: "audit",
    title: "Auditoría",
    description: "Registro de cambios y actividad por usuario.",
    href: (orgSlug) => `/${orgSlug}/audit`,
    Icon: History,
    resource: "audit",
  },
];
