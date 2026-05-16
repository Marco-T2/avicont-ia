"use client";

import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Home, ArrowRight } from "lucide-react";
import Link from "next/link";
import CreateFarmDialog from "@/components/farms/create-farm-dialog";
import type { FarmSnapshotWithLots } from "@/modules/farm/presentation/server";

interface FarmsPageClientProps {
  orgSlug: string;
  memberId: string;
  farms: FarmSnapshotWithLots[];
}

export default function FarmsPageClient({
  orgSlug,
  memberId,
  farms,
}: FarmsPageClientProps) {
  const router = useRouter();

  return (
    <>
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Mis Granjas</h1>
          <p className="text-muted-foreground">
            Administra tus granjas y lotes de pollos
          </p>
        </div>
        <CreateFarmDialog
          orgSlug={orgSlug}
          memberId={memberId}
          onCreated={() => router.refresh()}
        />
      </div>

      {/* Farms List */}
      {farms.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Home className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-muted-foreground text-lg mb-2">
                No tenes granjas todavia
              </p>
              <p className="text-sm text-muted-foreground">
                Crea tu primera granja para empezar a registrar tus lotes
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {farms.map((farm) => {
            const activeLots = farm.lots.filter(
              (l) => l.status === "ACTIVE",
            ).length;
            const totalLots = farm.lots.length;

            return (
              <Link
                key={farm.id}
                href={`/${orgSlug}/farms/${farm.id}`}
              >
                <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                  <CardContent>
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <h3 className="font-semibold text-lg">{farm.name}</h3>
                        {farm.location && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {farm.location}
                          </p>
                        )}
                      </div>
                      <ArrowRight className="h-5 w-5 text-muted-foreground" />
                    </div>

                    <div className="mt-4 flex gap-2">
                      <Badge variant="secondary">
                        {totalLots} {totalLots === 1 ? "lote" : "lotes"}
                      </Badge>
                      {activeLots > 0 && (
                        <Badge className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200">
                          {activeLots} {activeLots === 1 ? "activo" : "activos"}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
