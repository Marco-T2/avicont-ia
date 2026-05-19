/**
 * backfill-ar-description.ts — Regenera AccountsReceivable.description histórico.
 *
 * Contexto (Bug G del plan de continuación glosa-enriquecida): aunque
 * sale.service.post + createAndPost + updatePosted ya usan buildSaleGlosa,
 * los AR existentes en DB tienen description cuajada al post inicial con
 * passthrough viejo ("VENTA: Marco VG- por Bs. 100,00 ()" o similar).
 * Este script regenera AR.description para AR ya posteados:
 *
 *   sourceType = 'sale'     → buildSaleGlosa(Sale + Contact + details)
 *   sourceType = 'dispatch' → Dispatch.description (copia tal cual; Marco
 *                              lock: preservar el formato peso/kg actual)
 *   orphan (sale/dispatch borrado) → skip (registrado en log)
 *
 * Uso:
 *   pnpm exec tsx scripts/backfill-ar-description.ts --dry-run  # preview
 *   pnpm exec tsx scripts/backfill-ar-description.ts            # aplica
 */
import { prisma } from "@/lib/prisma";
import { buildSaleGlosa } from "@/modules/sale/domain/sale-glosa-builder";

type Counts = {
  saleUpdated: number;
  dispatchUpdated: number;
  orphanSale: number;
  orphanDispatch: number;
  unknownSourceType: number;
};

async function rebuildSaleAr(
  ar: { id: string; sourceId: string | null },
): Promise<{ kind: "ok"; description: string } | { kind: "orphan" }> {
  if (!ar.sourceId) return { kind: "orphan" };
  const sale = await prisma.sale.findUnique({
    where: { id: ar.sourceId },
    select: {
      referenceNumber: true,
      totalAmount: true,
      date: true,
      contact: { select: { name: true } },
      details: { orderBy: { order: "asc" }, select: { description: true } },
    },
  });
  if (!sale) return { kind: "orphan" };
  const description = buildSaleGlosa({
    contactName: sale.contact.name,
    referenceNumber: String(sale.referenceNumber ?? ""),
    totalAmount: Number(sale.totalAmount),
    lineConcepts: sale.details.map((d) => d.description),
    saleDate: sale.date,
  });
  return { kind: "ok", description };
}

async function rebuildDispatchAr(
  ar: { id: string; sourceId: string | null },
): Promise<{ kind: "ok"; description: string } | { kind: "orphan" }> {
  if (!ar.sourceId) return { kind: "orphan" };
  const dispatch = await prisma.dispatch.findUnique({
    where: { id: ar.sourceId },
    select: { description: true },
  });
  if (!dispatch) return { kind: "orphan" };
  return { kind: "ok", description: dispatch.description };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  console.log(`Backfill AR.description — ${dryRun ? "DRY-RUN (no escribe)" : "APPLY"}`);

  const ars = await prisma.accountsReceivable.findMany({
    where: { sourceType: { in: ["sale", "dispatch"] }, sourceId: { not: null } },
    select: { id: true, description: true, sourceType: true, sourceId: true },
    orderBy: { createdAt: "asc" },
  });
  console.log(`AR candidatos: ${ars.length}`);

  const counts: Counts = {
    saleUpdated: 0,
    dispatchUpdated: 0,
    orphanSale: 0,
    orphanDispatch: 0,
    unknownSourceType: 0,
  };
  const orphanIds: string[] = [];
  const samples: Array<{ id: string; sourceType: string; before: string; after: string }> = [];

  for (const ar of ars) {
    let result: { kind: "ok"; description: string } | { kind: "orphan" };
    if (ar.sourceType === "sale") {
      result = await rebuildSaleAr(ar);
      if (result.kind === "orphan") {
        counts.orphanSale++;
        orphanIds.push(ar.id);
        continue;
      }
    } else if (ar.sourceType === "dispatch") {
      result = await rebuildDispatchAr(ar);
      if (result.kind === "orphan") {
        counts.orphanDispatch++;
        orphanIds.push(ar.id);
        continue;
      }
    } else {
      counts.unknownSourceType++;
      continue;
    }

    if (result.description === ar.description) {
      // Already correct — skip the UPDATE (idempotent).
      continue;
    }

    if (samples.length < 5) {
      samples.push({
        id: ar.id,
        sourceType: ar.sourceType ?? "",
        before: ar.description,
        after: result.description,
      });
    }

    if (!dryRun) {
      await prisma.accountsReceivable.update({
        where: { id: ar.id },
        data: { description: result.description },
      });
    }
    if (ar.sourceType === "sale") counts.saleUpdated++;
    else counts.dispatchUpdated++;
  }

  console.log("\nResumen:");
  console.log(`  sale  AR actualizados:     ${counts.saleUpdated}`);
  console.log(`  dispatch AR actualizados:  ${counts.dispatchUpdated}`);
  console.log(`  orphans sale (skip):       ${counts.orphanSale}`);
  console.log(`  orphans dispatch (skip):   ${counts.orphanDispatch}`);
  console.log(`  sourceType desconocido:    ${counts.unknownSourceType}`);

  if (samples.length > 0) {
    console.log(`\nMuestras (primeros ${samples.length}):`);
    for (const s of samples) {
      console.log(`  [${s.sourceType}] ${s.id}`);
      console.log(`    antes:    ${s.before}`);
      console.log(`    después:  ${s.after}`);
    }
  }

  if (orphanIds.length > 0 && orphanIds.length <= 20) {
    console.log(`\nOrphan AR IDs (sale/dispatch source borrado):`);
    for (const id of orphanIds) console.log(`  ${id}`);
  } else if (orphanIds.length > 20) {
    console.log(`\nOrphan AR: ${orphanIds.length} (lista omitida — primeros 5):`);
    for (const id of orphanIds.slice(0, 5)) console.log(`  ${id}`);
  }

  if (dryRun) {
    console.log("\n[dry-run] No se escribió nada. Re-correr sin --dry-run para aplicar.");
  }
}

main()
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
