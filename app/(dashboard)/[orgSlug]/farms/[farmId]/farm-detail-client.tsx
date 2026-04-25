"use client";

import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, ArrowLeft, ArrowRight, Egg } from "lucide-react";
import Link from "next/link";
import CreateLotDialog from "@/components/lots/create-lot-dialog";
import type { FarmWithLots } from "@/features/farms";
import type { ChickenLot } from "@/generated/prisma/client";

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

interface FarmDetailClientProps {
  orgSlug: string;
  farm: FarmWithLots;
  lots: ChickenLot[];
}

export default function FarmDetailClient({
  orgSlug,
  farm,
  lots,
}: FarmDetailClientProps) {
  const router = useRouter();

  return (
    <div className="space-y-8">
      {/* Back + Header */}
      <div>
        <Link href={`/${orgSlug}/farms`}>
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Volver a Granjas
          </Button>
        </Link>

        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold">{farm.name}</h1>
            {farm.location && (
              <p className="text-muted-foreground flex items-center gap-1 mt-1">
                <MapPin className="h-4 w-4" />
                {farm.location}
              </p>
            )}
          </div>
          <CreateLotDialog
            orgSlug={orgSlug}
            farmId={farm.id}
            onCreated={() => router.refresh()}
          />
        </div>
      </div>

      {/* Lots */}
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
          <div className="grid gap-4 md:grid-cols-2">
            {lots.map((lot) => {
              const status = STATUS_CONFIG[lot.status] ?? {
                label: lot.status,
                className:
                  "bg-gray-100 dark:bg-gray-800/50 text-gray-800 dark:text-gray-200",
              };

              return (
                <Link
                  key={lot.id}
                  href={`/${orgSlug}/lots/${lot.id}`}
                >
                  <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-lg">
                              {lot.name}
                            </h3>
                            <Badge className={status.className}>
                              {status.label}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Galpon #{lot.barnNumber}
                          </p>
                        </div>
                        <ArrowRight className="h-5 w-5 text-muted-foreground" />
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Pollos iniciales</p>
                          <p className="font-medium">
                            {lot.initialCount.toLocaleString("es-BO")}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Inicio</p>
                          <p className="font-medium">
                            {new Date(lot.startDate).toLocaleDateString(
                              "es-BO",
                            )}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
