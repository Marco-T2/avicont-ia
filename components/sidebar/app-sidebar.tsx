"use client";

import { useParams } from "next/navigation";
import {
  Bot,
  Calculator,
  FileText,
  PanelLeftClose,
  PanelLeftOpen,
  Tractor,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { canAccess, type Resource } from "@/features/shared/permissions";
import { useOrgRole } from "@/components/common/use-org-role";
import { useSidebar } from "./sidebar-provider";
import { NavItem, type NavSubItem } from "./nav-item";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  TooltipProvider,
} from "@/components/ui/tooltip";

interface NavItemConfig {
  icon: React.ReactNode;
  label: string;
  href?: string;
  onClick?: () => void;
  children?: NavSubItem[];
  resource?: Resource;
}

interface AppSidebarProps {
  onOpenAgentChat: () => void;
}

export function AppSidebar({ onOpenAgentChat }: AppSidebarProps) {
  const { isCollapsed, toggleSidebar, isMobileOpen, toggleMobile } =
    useSidebar();
  const { role } = useOrgRole();
  const params = useParams();
  const orgSlug = params?.orgSlug as string;

  const navItems: NavItemConfig[] = [
    {
      icon: <Bot className="h-5 w-5" />,
      label: "Agente IA",
      onClick: onOpenAgentChat,
      resource: "agent",
    },
    {
      icon: <Tractor className="h-5 w-5" />,
      label: "Granjas",
      resource: "farms",
      children: [
        { label: "Mis Granjas", href: `/${orgSlug}/farms` },
      ],
    },
    {
      icon: <Calculator className="h-5 w-5" />,
      label: "Contabilidad",
      resource: "accounting",
      children: [
        { label: "Operaciones", isSeparator: true },
        { label: "Despachos", href: `/${orgSlug}/dispatches` },
        { label: "Cobros y Pagos", href: `/${orgSlug}/payments` },
        { label: "Cuentas por Cobrar", href: `/${orgSlug}/accounting/cxc` },
        { label: "Cuentas por Pagar", href: `/${orgSlug}/accounting/cxp` },
        { label: "Contabilidad", isSeparator: true },
        { label: "Plan de Cuentas", href: `/${orgSlug}/accounting/accounts` },
        { label: "Libro Diario", href: `/${orgSlug}/accounting/journal` },
        { label: "Libro Mayor", href: `/${orgSlug}/accounting/ledger` },
        { label: "Contactos", href: `/${orgSlug}/accounting/contacts` },
        { label: "Reportes", href: `/${orgSlug}/accounting/reports` },
        { label: "Configuración", isSeparator: true },
        { label: "Períodos Fiscales", href: `/${orgSlug}/accounting/periods` },
        { label: "Tipos de Comprobante", href: `/${orgSlug}/accounting/voucher-types` },
        { label: "Configuración General", href: `/${orgSlug}/settings` },
        { label: "Tipos de Producto", href: `/${orgSlug}/settings/product-types` },
      ],
    },
    {
      icon: <FileText className="h-5 w-5" />,
      label: "Documentos",
      href: `/${orgSlug}/documents`,
      resource: "documents",
    },
    {
      icon: <Users className="h-5 w-5" />,
      label: "Miembros",
      href: `/${orgSlug}/members`,
      resource: "members",
    },
  ];

  const filteredItems = navItems.filter((item) => {
    if (!item.resource) return true;
    if (!role) return false;
    return canAccess(role, item.resource);
  });

  const sidebarContent = (
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
        <TooltipProvider>
          <nav className="flex flex-col gap-1">
            {filteredItems.map((item) => (
              <NavItem
                key={item.label}
                icon={item.icon}
                label={item.label}
                href={item.href}
                onClick={item.onClick}
                children={item.children}
              />
            ))}
          </nav>
        </TooltipProvider>
      </ScrollArea>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden md:flex h-full flex-col border-r bg-white transition-all duration-200",
          isCollapsed ? "w-16" : "w-64"
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
