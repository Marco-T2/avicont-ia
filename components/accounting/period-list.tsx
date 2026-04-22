"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, CalendarDays } from "lucide-react";
import PeriodCreateDialog from "./period-create-dialog";
import type { FiscalPeriod } from "@/features/fiscal-periods";

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("es-BO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

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
                <tr className="border-b bg-gray-50">
                  <th className="text-left py-3 px-4 font-medium text-gray-600">
                    Nombre
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">
                    Año
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">
                    Inicio
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">
                    Cierre
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">
                    Estado
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {periods.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center">
                      <CalendarDays className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-600">
                        No hay períodos fiscales registrados
                      </p>
                      <p className="text-sm text-gray-400 mt-1">
                        Cree el primer período para comenzar
                      </p>
                    </td>
                  </tr>
                ) : (
                  periods.map((period) => (
                    <tr key={period.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium">{period.name}</td>
                      <td className="py-3 px-4 font-mono">{period.year}</td>
                      <td className="py-3 px-4">
                        {formatDate(period.startDate)}
                      </td>
                      <td className="py-3 px-4">
                        {formatDate(period.endDate)}
                      </td>
                      <td className="py-3 px-4">
                        {period.status === "OPEN" ? (
                          <Badge className="bg-green-100 text-green-800">
                            Abierto
                          </Badge>
                        ) : (
                          <Badge className="bg-gray-100 text-gray-600">
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
