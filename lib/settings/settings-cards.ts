import {
  Settings,
  Calendar,
  Receipt,
  Package,
  FileText,
  Users,
  ShieldCheck,
  Building2,
  type LucideIcon,
} from "lucide-react";

/**
 * Card definition for the settings hub page.
 *
 * REQ-OP.8 adds the "Perfil de Empresa" card (Building2 icon) in canonical
 * position — 8th (after "Roles y Permisos").
 */
interface SettingsCard {
  id: string;
  title: string;
  description: string;
  href: (orgSlug: string) => string;
  Icon: LucideIcon;
}

export const SETTINGS_CARDS: SettingsCard[] = [
  {
    id: "general",
    title: "Configuración General",
    description: "Cuentas contables y parámetros de la organización",
    href: (orgSlug) => `/${orgSlug}/settings/general`,
    Icon: Settings,
  },
  {
    id: "periods",
    title: "Períodos Fiscales",
    description: "Apertura y cierre de períodos contables",
    href: (orgSlug) => `/${orgSlug}/settings/periods`,
    Icon: Calendar,
  },
  {
    id: "voucher-types",
    title: "Tipos de Comprobante",
    description: "Prefijos y correlativos de comprobantes",
    href: (orgSlug) => `/${orgSlug}/settings/voucher-types`,
    Icon: Receipt,
  },
  {
    id: "product-types",
    title: "Tipos de Producto",
    description: "Catálogo de productos y sus cuentas asociadas",
    href: (orgSlug) => `/${orgSlug}/settings/product-types`,
    Icon: Package,
  },
  {
    id: "operational-doc-types",
    title: "Tipos de Documento",
    description: "Documentos operativos (remitos, órdenes, etc.)",
    href: (orgSlug) => `/${orgSlug}/settings/operational-doc-types`,
    Icon: FileText,
  },
  {
    id: "members",
    title: "Miembros",
    description: "Invitaciones y asignación de roles por usuario",
    href: (orgSlug) => `/${orgSlug}/members`,
    Icon: Users,
  },
  {
    id: "roles",
    title: "Roles y Permisos",
    description: "Matriz de qué puede hacer cada rol en cada módulo",
    href: (orgSlug) => `/${orgSlug}/settings/roles`,
    Icon: ShieldCheck,
  },
  {
    id: "company",
    title: "Perfil de Empresa",
    description: "Identidad, logo y firmas por tipo de documento",
    href: (orgSlug) => `/${orgSlug}/settings/company`,
    Icon: Building2,
  },
];
