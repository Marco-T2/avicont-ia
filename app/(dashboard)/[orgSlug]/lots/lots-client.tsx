"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Home } from "lucide-react";
import CreateLotDialog from "@/components/lots/create-lot-dialog";
import type { LotSnapshot } from "@/modules/lot/presentation/server";

interface LotsPageClientProps {
  orgSlug: string;
  lots: LotSnapshot[];
}

const STATUS_LABEL: Record<LotSnapshot["status"], string> = {
  ACTIVE: "Activo",
  INACTIVE: "Inactivo",
};

const STATUS_BADGE_CLASS: Record<LotSnapshot["status"], string> = {
  ACTIVE:
    "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200",
  INACTIVE:
    "bg-gray-100 dark:bg-gray-800/50 text-gray-800 dark:text-gray-200",
};

/**
 * REQ-204 flat lot table. UI-side sort: `createdAt DESC` (newest
 * first). Domain `LotService.list` returns entities in repository
 * order — the UI owns the presentation order so the underlying repo
 * can stay stable.
 *
 * REQ-205 client-derived farmName autocomplete is handled inside
 * `CreateLotDialog` (T19), not here — this table is the source data.
 */
export default function LotsPageClient({
  orgSlug,
  lots,
}: LotsPageClientProps) {
  const router = useRouter();

  const header = (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold">Mis Lotes</h1>
        <p className="text-muted-foreground">
          Lotes de pollos de la organizacion
        </p>
      </div>
      <CreateLotDialog
        orgSlug={orgSlug}
        onCreated={() => router.refresh()}
      />
    </div>
  );

  if (lots.length === 0) {
    return (
      <div className="space-y-6">
        {header}
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Home className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-muted-foreground text-lg mb-2">
                No tenes lotes todavia
              </p>
              <p className="text-sm text-muted-foreground">
                Crea tu primer lote para empezar a registrar la produccion
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const sorted = [...lots].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );

  return (
    <div className="space-y-6">
      {header}

      <Card>
        <CardContent className="p-0">
          {/*
            Post simplify-lot-identifier: the table collapses to 3 cols
            — the `displayName` ("Granja - DD/MM/YYYY") is the only
            identifier the user sees, and it's the linked cell that
            opens detail. Galpón is gone (column dropped); raw `name`
            is gone (column dropped).
          */}
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left p-3 text-sm font-medium">Lote</th>
                <th className="text-left p-3 text-sm font-medium">
                  Pollos
                </th>
                <th className="text-left p-3 text-sm font-medium">
                  Estado
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((lot) => (
                <tr
                  key={lot.id}
                  className="border-b hover:bg-muted/40 transition-colors"
                >
                  <td className="p-3 text-sm">
                    <Link
                      href={`/${orgSlug}/lots/${lot.id}`}
                      className="text-primary hover:underline"
                    >
                      {lot.displayName}
                    </Link>
                  </td>
                  <td className="p-3 text-sm">
                    {lot.initialCount.toLocaleString("es-BO")}
                  </td>
                  <td className="p-3 text-sm">
                    <Badge className={STATUS_BADGE_CLASS[lot.status]}>
                      {STATUS_LABEL[lot.status]}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
