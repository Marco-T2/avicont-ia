"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, CalendarDays } from "lucide-react";
import PeriodCreateDialog from "./period-create-dialog";
import type { FiscalPeriod } from "@/modules/fiscal-periods/presentation/index";
import { formatDateBO } from "@/lib/date-utils";

interface PeriodListProps {
  orgSlug: string;
  periods: FiscalPeriod[];
}

export default function PeriodList({ orgSlug, periods }: PeriodListProps) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Período
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                    Nombre
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                    Año
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                    Inicio
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                    Cierre
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                    Estado
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {periods.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center">
                      <CalendarDays className="h-10 w-10 text-muted-foreground/60 mx-auto mb-3" />
                      <p className="text-muted-foreground">
                        No hay períodos fiscales registrados
                      </p>
                      <p className="text-sm text-muted-foreground/70 mt-1">
                        Cree el primer período para comenzar
                      </p>
                    </td>
                  </tr>
                ) : (
                  periods.map((period) => (
                    <tr key={period.id} className="border-b hover:bg-accent/50">
                      <td className="py-3 px-4 font-medium">{period.name}</td>
                      <td className="py-3 px-4 font-mono">{period.year}</td>
                      <td className="py-3 px-4">
                        {formatDateBO(period.startDate)}
                      </td>
                      <td className="py-3 px-4">
                        {formatDateBO(period.endDate)}
                      </td>
                      <td className="py-3 px-4">
                        {period.status === "OPEN" ? (
                          <Badge className="bg-success/10 text-success dark:bg-success/20">
                            Abierto
                          </Badge>
                        ) : (
                          <Badge className="bg-muted text-muted-foreground">
                            Cerrado
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {period.status === "OPEN" && (
                          <Button variant="outline" size="sm" asChild>
                            <Link
                              href={`/${orgSlug}/accounting/monthly-close?periodId=${period.id}`}
                            >
                              Cerrar
                            </Link>
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <PeriodCreateDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        orgSlug={orgSlug}
        onCreated={() => {
          setShowCreate(false);
          router.refresh();
        }}
      />
    </>
  );
}
