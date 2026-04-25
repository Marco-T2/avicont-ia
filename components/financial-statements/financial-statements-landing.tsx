// Componente de aterrizaje con las dos tarjetas de estados financieros
// Puede ser Server o Client Component — es puramente presentacional
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BarChart3, Scale } from "lucide-react";

interface FinancialStatementsLandingProps {
  orgSlug: string;
}

export function FinancialStatementsLanding({
  orgSlug,
}: FinancialStatementsLandingProps) {
  const cards = [
    {
      title: "Balance General",
      description:
        "Estado de Situación Patrimonial a una fecha de corte. Muestra Activos, Pasivos y Patrimonio de la organización con verificación de ecuación contable.",
      href: `/${orgSlug}/accounting/financial-statements/balance-sheet`,
      icon: <Scale className="h-8 w-8 text-info" />,
      color: "border-info/30 hover:border-info/60 hover:bg-info/10",
    },
    {
      title: "Estado de Resultados",
      description:
        "Análisis de Ingresos y Gastos para un período o rango de fechas. Incluye Utilidad Operativa y Utilidad Neta del ejercicio.",
      href: `/${orgSlug}/accounting/financial-statements/income-statement`,
      icon: <BarChart3 className="h-8 w-8 text-success" />,
      color: "border-success/30 hover:border-success/60 hover:bg-success/10",
    },
  ];

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {cards.map((card) => (
        <Link key={card.title} href={card.href}>
          <Card
            className={`h-full cursor-pointer border-2 transition-colors ${card.color}`}
          >
            <CardHeader className="flex flex-row items-center gap-4 space-y-0">
              {card.icon}
              <CardTitle className="text-xl">{card.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{card.description}</p>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
