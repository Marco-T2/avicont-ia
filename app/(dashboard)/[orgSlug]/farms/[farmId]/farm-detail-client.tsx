"use client";

import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { MapPin, ArrowLeft, Egg, DollarSign, Skull } from "lucide-react";
import Link from "next/link";
import CreateLotDialog from "@/components/lots/create-lot-dialog";
import RegistrarConIABoton from "@/components/agent/registrar-con-ia-boton";
import type { FarmSnapshot } from "@/modules/farm/presentation/server";
import type { LotSnapshot, LotSummaryShape } from "@/modules/lot/presentation/server";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  ACTIVE: {
    label: "Activo",
    className:
      "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200",
  },
  CLOSED: {
    label: "Cerrado",
    className:
      "bg-gray-100 dark:bg-gray-800/50 text-gray-800 dark:text-gray-200",
  },
  SOLD: {
    label: "Vendido",
    className:
      "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200",
  },
};

function formatCurrency(amount: number): string {
  return `Bs. ${amount.toLocaleString("es-BO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

interface FarmDetailClientProps {
  orgSlug: string;
  farm: FarmSnapshot;
  lots: Array<{ lot: LotSnapshot; summary: LotSummaryShape }>;
  farmMetrics: { pollosTotales: number; gastoMes: number; mortalidadMes: number };
}

export default function FarmDetailClient({
  orgSlug,
  farm,
  lots,
  farmMetrics,
}: FarmDetailClientProps) {
  const router = useRouter();

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Back + Header */}
      <div>
        <Link href={`/${orgSlug}/farms`}>
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Volver a Granjas
          </Button>
        </Link>

        <div className="flex justify-between items-start gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">{farm.name}</h1>
            {farm.location && (
              <p className="text-muted-foreground flex items-center gap-1 mt-1 text-sm">
                <MapPin className="h-4 w-4" />
                {farm.location}
              </p>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-2 shrink-0">
            <RegistrarConIABoton
              orgSlug={orgSlug}
              contextHints={{
                farmId: farm.id,
                farmName: farm.name,
              }}
            />
            <CreateLotDialog
              orgSlug={orgSlug}
              farmId={farm.id}
              onCreated={() => router.refresh()}
            />
          </div>
        </div>
      </div>

      {/* 3 granja-header métricas globales — big-picture context awareness pre-accordion */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <Card>
          <CardContent className="pt-4 sm:pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Egg className="h-4 w-4 text-green-600 dark:text-green-400" />
              <p className="text-xs sm:text-sm text-muted-foreground">Pollos totales</p>
            </div>
            <p className="text-lg sm:text-2xl font-bold">
              {farmMetrics.pollosTotales.toLocaleString("es-BO")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 sm:pt-6">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <p className="text-xs sm:text-sm text-muted-foreground">Gasto del mes</p>
            </div>
            <p className="text-lg sm:text-2xl font-bold">
              {formatCurrency(farmMetrics.gastoMes)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 sm:pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Skull className="h-4 w-4 text-red-600 dark:text-red-400" />
              <p className="text-xs sm:text-sm text-muted-foreground">Mortalidad del mes</p>
            </div>
            <p className="text-lg sm:text-2xl font-bold">
              {farmMetrics.mortalidadMes.toLocaleString("es-BO")}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Lots accordion */}
      {lots.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Egg className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-muted-foreground text-lg mb-2">
                No hay lotes en esta granja
              </p>
              <p className="text-sm text-muted-foreground">
                Crea un lote para empezar a registrar tus pollos
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">
            Lotes ({lots.length})
          </h2>
          <Accordion type="single" collapsible className="w-full">
            {lots.map(({ lot, summary }) => {
              const status = STATUS_CONFIG[lot.status] ?? {
                label: lot.status,
                className:
                  "bg-gray-100 dark:bg-gray-800/50 text-gray-800 dark:text-gray-200",
              };
              return (
                <AccordionItem key={lot.id} value={lot.id}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex flex-col gap-3 flex-1 mr-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-base sm:text-lg">
                          {lot.name}
                        </h3>
                        <Badge className={status.className}>{status.label}</Badge>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 text-xs sm:text-sm text-left w-full">
                        <div>
                          <p className="text-muted-foreground">Galpón</p>
                          <p className="font-medium">#{lot.barnNumber}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Total gastado</p>
                          <p className="font-medium">
                            {formatCurrency(summary.totalExpenses)}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Pollos vivos</p>
                          <p className="font-medium">
                            {summary.aliveCount.toLocaleString("es-BO")}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Costo/pollo</p>
                          <p className="font-medium">
                            {summary.costPerChicken > 0
                              ? formatCurrency(summary.costPerChicken)
                              : "—"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    {/* C1 expanded scope: 10 expenses + 5 mortality + 3 botones (AI + manual gasto + manual mortalidad) — placeholder pre-C1 */}
                    <p className="text-sm text-muted-foreground py-2">
                      Detalles ampliados próximamente (C1 expand).
                    </p>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </div>
      )}
    </div>
  );
}
