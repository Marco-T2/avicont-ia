import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  BookOpen,
  FileText,
  Calculator,
  BarChart3,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { requireAuth } from "@/features/shared";
import { requireOrgAccess } from "@/modules/organizations/presentation/server";
import { JournalService } from "@/features/accounting/server";

interface AccountingPageProps {
  params: Promise<{ orgSlug: string }>;
}

export default async function AccountingPage({ params }: AccountingPageProps) {
  const { orgSlug } = await params;

  // RBAC-EXCEPTION: Dashboard hub with summary cards only; sub-sections each gated. Hub gate redundant. Decision: rbac-legacy-auth-chain-migration 2026-04-19.
  let userId: string;
  try {
    const session = await requireAuth();
    userId = session.userId;
  } catch {
    redirect("/sign-in");
  }

  let orgId: string;
  try {
    orgId = await requireOrgAccess(userId, orgSlug);
  } catch {
    redirect("/select-org");
  }

  const journalService = new JournalService();
  let entryCount = 0;
  let lastEntryDate: string | null = null;

  try {
    const entries = await journalService.list(orgId);
    entryCount = entries.length;
    if (entries.length > 0) {
      const sorted = entries.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      );
      lastEntryDate = new Date(sorted[0].date).toLocaleDateString("es-BO", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    }
  } catch {
    // Services may not be ready yet
  }

  const modules = [
    {
      title: "Plan de Cuentas",
      description: "Administrar las cuentas contables de la organizacion",
      href: `/${orgSlug}/accounting/accounts`,
      icon: BookOpen,
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-50 dark:bg-blue-950/40",
    },
    {
      title: "Libro Diario",
      description: "Registrar y consultar asientos contables",
      href: `/${orgSlug}/accounting/journal`,
      icon: FileText,
      color: "text-green-600 dark:text-green-400",
      bgColor: "bg-green-50 dark:bg-green-950/40",
    },
    {
      title: "Libro Mayor",
      description: "Consultar movimientos por cuenta",
      href: `/${orgSlug}/accounting/ledger`,
      icon: Calculator,
      color: "text-purple-600 dark:text-purple-400",
      bgColor: "bg-purple-50 dark:bg-purple-950/40",
    },
    {
      title: "Reportes",
      description: "Catálogo de informes contables y estados financieros",
      href: `/${orgSlug}/informes`,
      icon: BarChart3,
      color: "text-orange-600 dark:text-orange-400",
      bgColor: "bg-orange-50 dark:bg-orange-950/40",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Contabilidad</h1>
        <p className="text-muted-foreground mt-1">
          Gestion contable de la organizacion
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total de Asientos</p>
            <p className="text-2xl font-bold mt-1">
              {entryCount.toLocaleString("es-BO")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Ultimo Asiento</p>
            <p className="text-2xl font-bold mt-1">
              {lastEntryDate ?? "Sin registros"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Module Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {modules.map((mod) => (
          <Link key={mod.href} href={mod.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardHeader className="flex flex-row items-center gap-4 pb-2">
                <div className={`p-3 rounded-lg ${mod.bgColor}`}>
                  <mod.icon className={`h-6 w-6 ${mod.color}`} />
                </div>
                <CardTitle className="text-lg">{mod.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">{mod.description}</p>
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
