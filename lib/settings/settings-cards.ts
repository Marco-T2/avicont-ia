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
  History,
  type LucideIcon,
} from "lucide-react";
import type { Resource } from "@/features/permissions";

/**
 * Card definition for the settings hub page.
 *
 * REQ-OP.8 originally introduced the "Perfil de Empresa" card. C3
 * sidebar-reorg-settings-hub added Plan de Cuentas + Cierre Mensual +
 * Auditoría. Cierre Mensual was later REMOVED — the unfiltered entry let
 * users land on /accounting/monthly-close without a periodId and manually
 * close December, breaking annual-close atomicity (December must be locked
 * inside the same tx as CC + auto-periods + CA). The only legitimate entry
 * to monthly-close is now the per-row "Cerrar" link from
 * `/{orgSlug}/settings/periods` (annual-period-list.tsx:301), which carries
 * `?periodId=...`.
 *
 * `group` buckets the card into a SETTINGS_GROUPS heading on the hub page.
 * Convention: `roles` shares the `members` resource gate.
 */
interface SettingsCard {
  id: string;
  title: string;
  description: string;
  href: (orgSlug: string) => string;
  Icon: LucideIcon;
  group: SettingsGroup;
  resource?: Resource;
}

export type SettingsGroup =
  | "Empresa y equipo"
  | "Contabilidad"
  | "Catálogos"
  | "Sistema";

export const SETTINGS_GROUPS: readonly SettingsGroup[] = [
  "Empresa y equipo",
  "Contabilidad",
  "Catálogos",
  "Sistema",
] as const;

export const SETTINGS_CARDS: SettingsCard[] = [
  {
    id: "company",
    title: "Perfil de Empresa",
    description: "Identidad, logo y firmas por tipo de documento",
    href: (orgSlug) => `/${orgSlug}/settings/company`,
    Icon: Building2,
    group: "Empresa y equipo",
    resource: "accounting-config",
  },
  {
    id: "members",
    title: "Miembros",
    description: "Invitaciones y asignación de roles por usuario",
    href: (orgSlug) => `/${orgSlug}/members`,
    Icon: Users,
    group: "Empresa y equipo",
    resource: "members",
  },
  {
    id: "roles",
    title: "Roles y Permisos",
    description: "Matriz de qué puede hacer cada rol en cada módulo",
    href: (orgSlug) => `/${orgSlug}/settings/roles`,
    Icon: ShieldCheck,
    group: "Empresa y equipo",
    resource: "members",
  },
  {
    id: "plan-cuentas",
    title: "Plan de Cuentas",
    description: "Catálogo y estructura de cuentas contables.",
    href: (orgSlug) => `/${orgSlug}/accounting/accounts`,
    Icon: FolderTree,
    group: "Contabilidad",
    resource: "accounting-config",
  },
  {
    id: "periods",
    title: "Períodos Fiscales",
    description: "Apertura y cierre de períodos contables",
    href: (orgSlug) => `/${orgSlug}/settings/periods`,
    Icon: Calendar,
    group: "Contabilidad",
    resource: "accounting-config",
  },
  {
    id: "general",
    title: "Configuración General",
    description: "Cuentas contables y parámetros de la organización",
    href: (orgSlug) => `/${orgSlug}/settings/general`,
    Icon: Settings,
    group: "Contabilidad",
    resource: "accounting-config",
  },
  {
    id: "voucher-types",
    title: "Tipos de Comprobante",
    description: "Prefijos y correlativos de comprobantes",
    href: (orgSlug) => `/${orgSlug}/settings/voucher-types`,
    Icon: Receipt,
    group: "Catálogos",
    resource: "accounting-config",
  },
  {
    id: "product-types",
    title: "Tipos de Producto",
    description: "Catálogo de productos y sus cuentas asociadas",
    href: (orgSlug) => `/${orgSlug}/settings/product-types`,
    Icon: Package,
    group: "Catálogos",
    resource: "accounting-config",
  },
  {
    id: "operational-doc-types",
    title: "Tipos de Documento",
    description: "Documentos operativos (remitos, órdenes, etc.)",
    href: (orgSlug) => `/${orgSlug}/settings/operational-doc-types`,
    Icon: FileText,
    group: "Catálogos",
    resource: "accounting-config",
  },
  {
    id: "audit",
    title: "Auditoría",
    description: "Registro de cambios y actividad por usuario.",
    href: (orgSlug) => `/${orgSlug}/audit`,
    Icon: History,
    group: "Sistema",
    resource: "audit",
  },
];
