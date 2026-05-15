import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Calculator,
  FileText,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { canAccess, type Resource } from "@/features/permissions/server";

interface DashboardLightProps {
  orgSlug: string;
  orgId: string;
  role: string;
  totalEntries: number;
  lastEntryDate: string | null;
}

interface AccesoDef {
  title: string;
  description: string;
  href: (orgSlug: string) => string;
  resource: Resource;
  icon: typeof BookOpen;
  color: string;
  bgColor: string;
}

const ACCESOS: AccesoDef[] = [
  {
    title: "Plan de Cuentas",
    description: "Administrar las cuentas contables de la organización",
    href: (s) => `/${s}/accounting/accounts`,
    resource: "accounting-config",
    icon: BookOpen,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-950/40",
  },
  {
    title: "Libro Diario",
    description: "Registrar y consultar asientos contables",
    href: (s) => `/${s}/accounting/journal`,
    resource: "journal",
    icon: FileText,
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-50 dark:bg-green-950/40",
  },
  {
    title: "Libro Mayor",
    description: "Consultar movimientos por cuenta",
    href: (s) => `/${s}/accounting/ledger`,
    resource: "journal",
    icon: Calculator,
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-50 dark:bg-purple-950/40",
  },
  {
    title: "Reportes",
    description: "Catálogo de informes contables y estados financieros",
    href: (s) => `/${s}/informes`,
    resource: "reports",
    icon: BarChart3,
    color: "text-orange-600 dark:text-orange-400",
    bgColor: "bg-orange-50 dark:bg-orange-950/40",
  },
];

export async function DashboardLight({
  orgSlug,
  orgId,
  role,
  totalEntries,
  lastEntryDate,
}: DashboardLightProps) {
  const allowed = await Promise.all(
    ACCESOS.map((a) => canAccess(role, a.resource, "read", orgId)),
  );
  const visible = ACCESOS.filter((_, i) => allowed[i]);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total de Asientos</p>
            <p className="text-2xl font-bold mt-1">
              {totalEntries.toLocaleString("es-BO")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Último Asiento</p>
            <p className="text-2xl font-bold mt-1">
              {lastEntryDate ? formatISODate(lastEntryDate) : "Sin registros"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {visible.map((a) => (
          <Link key={a.title} href={a.href(orgSlug)}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardHeader className="flex flex-row items-center gap-4 pb-2">
                <div className={`p-3 rounded-lg ${a.bgColor}`}>
                  <a.icon className={`h-6 w-6 ${a.color}`} />
                </div>
                <CardTitle className="text-lg">{a.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">{a.description}</p>
                  <ArrowRight className="h-4 w-4 text-muted-foreground/70" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

function formatISODate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
