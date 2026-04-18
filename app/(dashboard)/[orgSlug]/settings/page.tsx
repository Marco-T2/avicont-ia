import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Settings,
  Calendar,
  Receipt,
  Package,
  FileText,
  Users,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { requirePermission } from "@/features/shared/permissions.server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface SettingsHubPageProps {
  params: Promise<{ orgSlug: string }>;
}

export const metadata: Metadata = {
  title: "Configuración",
};

interface SettingsCard {
  id: string;
  title: string;
  description: string;
  href: (orgSlug: string) => string;
  Icon: LucideIcon;
}

const SETTINGS_CARDS: SettingsCard[] = [
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
];

export default async function SettingsHubPage({ params }: SettingsHubPageProps) {
  const { orgSlug } = await params;

  try {
    await requirePermission("accounting-config", "read", orgSlug);
  } catch {
    redirect(`/${orgSlug}`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Configuración</h1>
        <p className="text-gray-500 mt-1">
          Catálogo de parámetros y catálogos de la organización
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SETTINGS_CARDS.map(({ id, title, description, href, Icon }) => (
          <Link
            key={id}
            href={href(orgSlug)}
            className="block h-full hover:no-underline"
            aria-label={title}
          >
            <Card size="sm" className="h-full transition-colors">
              <CardHeader>
                <div className="flex items-start gap-3">
                  <Icon className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <CardTitle className="text-sm">{title}</CardTitle>
                    <CardDescription className="mt-1">
                      {description}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent />
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
