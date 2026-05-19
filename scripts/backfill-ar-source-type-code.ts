/**
 * backfill-ar-source-type-code.ts — Backfill idempotente de AccountsReceivable.sourceTypeCode.
 *
 * Contexto: la migración 20260519151605_add_ar_source_type_code crea la columna y
 * ejecuta el backfill embebido. En DBs locales donde se crearon AR entre la
 * aplicación de la migración y el wiring T-07/T-08 (que setea sourceTypeCode en
 * el insert), esos AR quedaron con sourceTypeCode = NULL. Este script los rellena.
 *
 * Mapping (igual que migration.sql):
 *   sourceType = 'sale'     → 'VG'
 *   sourceType = 'dispatch' + dispatchType = 'NOTA_DESPACHO' → 'ND'
 *   sourceType = 'dispatch' + dispatchType = 'BOLETA_CERRADA' → 'BC'
 *   orphans (sourceId apunta a Sale/Dispatch borrado) → quedan NULL (REQ-GE-5 §5.8)
 *
 * Uso:
 *   pnpm exec tsx scripts/backfill-ar-source-type-code.ts --dry-run  # preview, no escribe
 *   pnpm exec tsx scripts/backfill-ar-source-type-code.ts            # aplica
 */
import { prisma } from "@/lib/prisma";

type Counts = { sale: number; ndDispatch: number; bcDispatch: number; orphans: number };

async function countByStatus(): Promise<{
  total: number;
  withCode: number;
  nullCode: number;
  byBreakdown: Array<{ sourceType: string | null; sourceTypeCode: string | null; count: number }>;
}> {
  const groups = await prisma.accountsReceivable.groupBy({
    by: ["sourceType", "sourceTypeCode"],
    _count: { _all: true },
  });
  const byBreakdown = groups.map((g) => ({
    sourceType: g.sourceType,
    sourceTypeCode: g.sourceTypeCode,
    count: g._count._all,
  }));
  const total = byBreakdown.reduce((s, g) => s + g.count, 0);
  const withCode = byBreakdown.filter((g) => g.sourceTypeCode !== null).reduce((s, g) => s + g.count, 0);
  return { total, withCode, nullCode: total - withCode, byBreakdown };
}

function printBreakdown(label: string, breakdown: Array<{ sourceType: string | null; sourceTypeCode: string | null; count: number }>) {
  console.log(`\n${label}:`);
  if (breakdown.length === 0) {
    console.log("  (sin filas)");
    return;
  }
  for (const row of breakdown) {
    const st = row.sourceType ?? "<null>";
    const stc = row.sourceTypeCode ?? "<NULL>";
    console.log(`  sourceType=${st.padEnd(10)} sourceTypeCode=${stc.padEnd(6)} count=${row.count}`);
  }
}

async function planCounts(): Promise<Counts> {
  const sale = await prisma.accountsReceivable.count({
    where: { sourceType: "sale", sourceTypeCode: null },
  });
  const dispatchNullArs = await prisma.accountsReceivable.findMany({
    where: { sourceType: "dispatch", sourceTypeCode: null },
    select: { id: true, sourceId: true },
  });
  const sourceIds = dispatchNullArs.map((ar) => ar.sourceId).filter((s): s is string => !!s);
  const dispatches = await prisma.dispatch.findMany({
    where: { id: { in: sourceIds } },
    select: { id: true, dispatchType: true },
  });
  const dispatchTypeById = new Map(dispatches.map((d) => [d.id, d.dispatchType]));
  let ndDispatch = 0;
  let bcDispatch = 0;
  let orphans = 0;
  for (const ar of dispatchNullArs) {
    const dt = ar.sourceId ? dispatchTypeById.get(ar.sourceId) : undefined;
    if (dt === "NOTA_DESPACHO") ndDispatch++;
    else if (dt === "BOLETA_CERRADA") bcDispatch++;
    else orphans++;
  }
  return { sale, ndDispatch, bcDispatch, orphans };
}

async function applyBackfill(): Promise<Counts> {
  const sale = await prisma.$executeRaw`
    UPDATE "accounts_receivable"
    SET "sourceTypeCode" = 'VG'
    WHERE "sourceType" = 'sale'
      AND "sourceTypeCode" IS NULL
  `;
  const ndDispatch = await prisma.$executeRaw`
    UPDATE "accounts_receivable" ar
    SET "sourceTypeCode" = 'ND'
    FROM "dispatches" d
    WHERE ar."sourceType" = 'dispatch'
      AND ar."sourceId" = d."id"
      AND d."dispatchType" = 'NOTA_DESPACHO'
      AND ar."sourceTypeCode" IS NULL
  `;
  const bcDispatch = await prisma.$executeRaw`
    UPDATE "accounts_receivable" ar
    SET "sourceTypeCode" = 'BC'
    FROM "dispatches" d
    WHERE ar."sourceType" = 'dispatch'
      AND ar."sourceId" = d."id"
      AND d."dispatchType" = 'BOLETA_CERRADA'
      AND ar."sourceTypeCode" IS NULL
  `;
  return { sale, ndDispatch, bcDispatch, orphans: 0 };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  console.log(`Backfill AR.sourceTypeCode — ${dryRun ? "DRY-RUN (no escribe)" : "APPLY"}`);

  const before = await countByStatus();
  printBreakdown("Estado actual", before.byBreakdown);
  console.log(`\n  total=${before.total}  withCode=${before.withCode}  nullCode=${before.nullCode}`);

  if (before.nullCode === 0) {
    console.log("\nNada que backfillear — todos los AR ya tienen sourceTypeCode.");
    return;
  }

  const plan = await planCounts();
  console.log(`\nPlan de updates:`);
  console.log(`  sale → 'VG':                ${plan.sale}`);
  console.log(`  dispatch NOTA_DESPACHO → 'ND': ${plan.ndDispatch}`);
  console.log(`  dispatch BOLETA_CERRADA → 'BC': ${plan.bcDispatch}`);
  console.log(`  orphans (quedan NULL):      ${plan.orphans}`);

  if (dryRun) {
    console.log("\n[dry-run] No se escribió nada. Re-correr sin --dry-run para aplicar.");
    return;
  }

  const result = await applyBackfill();
  console.log(`\nAplicado:`);
  console.log(`  sale → 'VG':                ${result.sale}`);
  console.log(`  dispatch NOTA_DESPACHO → 'ND': ${result.ndDispatch}`);
  console.log(`  dispatch BOLETA_CERRADA → 'BC': ${result.bcDispatch}`);

  const after = await countByStatus();
  printBreakdown("\nEstado final", after.byBreakdown);
  console.log(`\n  total=${after.total}  withCode=${after.withCode}  nullCode=${after.nullCode}`);
  if (after.nullCode > 0) {
    console.log(`\n[i] ${after.nullCode} filas quedan con sourceTypeCode=NULL — probablemente orphans (Sale/Dispatch borrado). REQ-GE-5 §5.8: builder usa fallback "DOC".`);
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
