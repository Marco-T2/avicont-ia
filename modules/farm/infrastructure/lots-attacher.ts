import "server-only";
import type { ChickenLot } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { Farm, FarmSnapshot } from "../domain/farm.entity";

/**
 * Hydrates `Farm` snapshot con `lots: ChickenLot[]` via `.toSnapshot()` direct
 * entity → snapshot mapping (Opción C precedent A5-C1 5ta aplicación cumulative
 * cross-POC — paired sister `contact-attacher.ts` EXACT mirror). Prisma raw
 * ChickenLot access infrastructure boundary per §13 NEW
 * `lots-attacher-prisma-direct-vs-cross-module-hex-coupling-axis-distinct`
 * 1ra evidencia matures Marco lock D1=a confirmed.
 */

export async function attachLots(
  organizationId: string,
  items: Farm[],
): Promise<(FarmSnapshot & { lots: ChickenLot[] })[]> {
  if (items.length === 0) return [];
  const farmIds = items.map((f) => f.id);
  const rows = await prisma.chickenLot.findMany({
    where: { organizationId, farmId: { in: farmIds } },
    orderBy: { name: "asc" },
  });
  const byFarmId = new Map<string, ChickenLot[]>();
  for (const lot of rows) {
    const arr = byFarmId.get(lot.farmId) ?? [];
    arr.push(lot);
    byFarmId.set(lot.farmId, arr);
  }
  return items.map((f) => ({ ...f.toSnapshot(), lots: byFarmId.get(f.id) ?? [] }));
}
