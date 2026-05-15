"use client";

import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";
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
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { AccountingDashboardDTO } from "@/modules/accounting/presentation/dto/dashboard.types";

interface DashboardProClientProps {
  data: AccountingDashboardDTO;
  orgSlug: string;
}

const TOP_ACCOUNTS_CHART_CONFIG = {
  movement: { label: "Movimiento (Bs.)", color: "var(--chart-1)" },
} satisfies ChartConfig;

const MONTHLY_TREND_CHART_CONFIG = {
  ingresos: { label: "Ingresos", color: "var(--chart-2)" },
  egresos: { label: "Egresos", color: "var(--chart-5)" },
} satisfies ChartConfig;

const ACCESOS = (orgSlug: string) => [
  {
    title: "Plan de Cuentas",
    href: `/${orgSlug}/accounting/accounts`,
    icon: BookOpen,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-950/40",
  },
  {
    title: "Libro Diario",
    href: `/${orgSlug}/accounting/journal`,
    icon: FileText,
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-50 dark:bg-green-950/40",
  },
  {
    title: "Libro Mayor",
    href: `/${orgSlug}/accounting/ledger`,
    icon: Calculator,
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-50 dark:bg-purple-950/40",
  },
  {
    title: "Reportes",
    href: `/${orgSlug}/informes`,
    icon: BarChart3,
    color: "text-orange-600 dark:text-orange-400",
    bgColor: "bg-orange-50 dark:bg-orange-950/40",
  },
] as const;

export function DashboardProClient({ data, orgSlug }: DashboardProClientProps) {
  const { kpi, topAccounts, monthlyTrend } = data;

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard label="Total de Asientos" value={kpi.totalEntries.toLocaleString("es-BO")} />
        <KpiCard
          label="Último Asiento"
          value={kpi.lastEntryDate ? formatISODate(kpi.lastEntryDate) : "Sin registros"}
        />
        <KpiCard
          label="Período"
          value={kpi.currentPeriod ? kpi.currentPeriod.name : "Sin período"}
          badge={kpi.currentPeriod?.status}
        />
        <KpiCard label="Activo" value={formatBs(kpi.activoTotal)} />
        <KpiCard label="Pasivo" value={formatBs(kpi.pasivoTotal)} />
        <KpiCard label="Patrimonio" value={formatBs(kpi.patrimonioTotal)} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cuentas más movidas del período</CardTitle>
          </CardHeader>
          <CardContent>
            {topAccounts.length === 0 ? (
              <EmptyPlaceholder
                message="Sin movimientos en el período"
                ctaLabel="Registrar asiento"
                ctaHref={`/${orgSlug}/accounting/journal`}
              />
            ) : (
              <>
                <ChartContainer config={TOP_ACCOUNTS_CHART_CONFIG} className="h-64 w-full">
                  <BarChart
                    data={topAccounts.map((a) => ({
                      account: a.code,
                      movement: Number(a.movementTotal),
                    }))}
                    layout="vertical"
                    margin={{ left: 8, right: 8 }}
                  >
                    <CartesianGrid horizontal={false} />
                    <XAxis type="number" hide />
                    <YAxis dataKey="account" type="category" tickLine={false} axisLine={false} width={64} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="movement" fill="var(--color-movement)" radius={4} />
                  </BarChart>
                </ChartContainer>
                <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                  {topAccounts.map((a) => (
                    <li key={a.code} className="flex justify-between gap-2">
                      <span className="truncate">{a.name}</span>
                      <span className="font-mono tabular-nums">{formatBs(a.movementTotal)}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ingresos vs Egresos · últimos 12 meses</CardTitle>
          </CardHeader>
          <CardContent>
            {monthlyTrend.length === 0 ? (
              <EmptyPlaceholder
                message="Tendencia mensual no disponible"
                ctaLabel="Ver Estados Financieros"
                ctaHref={`/${orgSlug}/accounting/financial-statements`}
              />
            ) : (
              <ChartContainer config={MONTHLY_TREND_CHART_CONFIG} className="h-64 w-full">
                <LineChart
                  data={monthlyTrend.map((p) => ({
                    month: p.month,
                    ingresos: Number(p.ingresos),
                    egresos: Number(p.egresos),
                  }))}
                  margin={{ left: 8, right: 8, top: 8 }}
                >
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line type="monotone" dataKey="ingresos" stroke="var(--color-ingresos)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="egresos" stroke="var(--color-egresos)" strokeWidth={2} dot={false} />
                </LineChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Accesos directos */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {ACCESOS(orgSlug).map((a) => (
          <Link key={a.href} href={a.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardContent className="flex items-center gap-3 py-4">
                <div className={`p-2 rounded-lg ${a.bgColor}`}>
                  <a.icon className={`h-5 w-5 ${a.color}`} />
                </div>
                <span className="text-sm font-medium flex-1">{a.title}</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground/70" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

function KpiCard({ label, value, badge }: { label: string; value: string; badge?: string }) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold mt-1 truncate">{value}</p>
        {badge && (
          <span className="inline-block mt-1 text-[10px] uppercase tracking-wide px-2 py-0.5 rounded bg-muted text-muted-foreground">
            {badge}
          </span>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyPlaceholder({
  message,
  ctaLabel,
  ctaHref,
}: {
  message: string;
  ctaLabel: string;
  ctaHref: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 px-4 text-sm text-muted-foreground gap-3">
      <p>{message}</p>
      <Link
        href={ctaHref}
        className="inline-flex items-center gap-1 text-primary hover:underline"
      >
        {ctaLabel}
        <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}

function formatBs(value: string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return `Bs. ${n.toLocaleString("es-BO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatISODate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
