/**
 * backfill-ap-source-type-code.ts — Backfill idempotente de AccountsPayable.sourceTypeCode.
 *
 * Contexto: la migración 20260523205139_add_ap_source_type_code crea la columna
 * `sourceTypeCode` (nullable). Los AccountsPayable creados antes del wiring
 * purchase.service (post()/createAndPost() setean sourceTypeCode en el insert)
 * quedaron con sourceTypeCode = NULL. Este script los rellena desde el
 * purchaseType de la Purchase originante.
 *
 * Mapping (espejo simétrico de backfill-ar-source-type-code.ts + paridad con
 * purchaseTypeToCode en modules/accounting/shared/infrastructure/document-type-codes.ts):
 *   purchaseType = 'FLETE'          → 'FL'
 *   purchaseType = 'POLLO_FAENADO'  → 'PF'
 *   purchaseType = 'COMPRA_GENERAL' → 'CG'
 *   purchaseType = 'SERVICIO'       → 'SV'
 *   orphans (sourceId apunta a Purchase borrado, o sourceType != 'purchase')
 *     → quedan NULL (REQ-GE-5 §5.8; builder fallback "DOC")
 *
 * Idempotente: cada UPDATE guarda `sourceTypeCode IS NULL` — re-correr no
 * re-escribe filas ya backfilleadas.
 *
 * Uso:
 *   pnpm exec tsx scripts/backfill-ap-source-type-code.ts --dry-run  # preview, no escribe
 *   pnpm exec tsx scripts/backfill-ap-source-type-code.ts            # aplica
 */
import { prisma } from "@/lib/prisma";

/**
 * Pure per-type mapping used by the backfill (extracted for unit-verification;
 * Extract-Before-Mock). Mirrors `purchaseTypeToCode` values WITHOUT the
 * `server-only` import so it stays importable from a script and a unit test.
 * Returns null for unknown/null input → orphan-safe (row stays NULL).
 */
export function purchaseTypeToBackfillCode(
  purchaseType: string | null,
): string | null {
  switch (purchaseType) {
    case "FLETE":
      return "FL";
    case "POLLO_FAENADO":
      return "PF";
    case "COMPRA_GENERAL":
      return "CG";
    case "SERVICIO":
      return "SV";
    default:
      return null;
  }
}

type Counts = { flete: number; polloFaenado: number; compraGeneral: number; servicio: number; orphans: number };

async function countByStatus(): Promise<{
  total: number;
  withCode: number;
  nullCode: number;
  byBreakdown: Array<{ sourceType: string | null; sourceTypeCode: string | null; count: number }>;
}> {
  const groups = await prisma.accountsPayable.groupBy({
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
  const purchaseNullAps = await prisma.accountsPayable.findMany({
    where: { sourceType: "purchase", sourceTypeCode: null },
    select: { id: true, sourceId: true },
  });
  const sourceIds = purchaseNullAps.map((ap) => ap.sourceId).filter((s): s is string => !!s);
  const purchases = await prisma.purchase.findMany({
    where: { id: { in: sourceIds } },
    select: { id: true, purchaseType: true },
  });
  const purchaseTypeById = new Map(purchases.map((p) => [p.id, p.purchaseType as string]));
  const counts: Counts = { flete: 0, polloFaenado: 0, compraGeneral: 0, servicio: 0, orphans: 0 };
  for (const ap of purchaseNullAps) {
    const code = ap.sourceId ? purchaseTypeToBackfillCode(purchaseTypeById.get(ap.sourceId) ?? null) : null;
    if (code === "FL") counts.flete++;
    else if (code === "PF") counts.polloFaenado++;
    else if (code === "CG") counts.compraGeneral++;
    else if (code === "SV") counts.servicio++;
    else counts.orphans++;
  }
  return counts;
}

async function applyBackfill(): Promise<Counts> {
  const flete = await prisma.$executeRaw`
    UPDATE "accounts_payable" ap
    SET "sourceTypeCode" = 'FL'
    FROM "purchases" p
    WHERE ap."sourceType" = 'purchase'
      AND ap."sourceId" = p."id"
      AND p."purchaseType" = 'FLETE'
      AND ap."sourceTypeCode" IS NULL
  `;
  const polloFaenado = await prisma.$executeRaw`
    UPDATE "accounts_payable" ap
    SET "sourceTypeCode" = 'PF'
    FROM "purchases" p
    WHERE ap."sourceType" = 'purchase'
      AND ap."sourceId" = p."id"
      AND p."purchaseType" = 'POLLO_FAENADO'
      AND ap."sourceTypeCode" IS NULL
  `;
  const compraGeneral = await prisma.$executeRaw`
    UPDATE "accounts_payable" ap
    SET "sourceTypeCode" = 'CG'
    FROM "purchases" p
    WHERE ap."sourceType" = 'purchase'
      AND ap."sourceId" = p."id"
      AND p."purchaseType" = 'COMPRA_GENERAL'
      AND ap."sourceTypeCode" IS NULL
  `;
  const servicio = await prisma.$executeRaw`
    UPDATE "accounts_payable" ap
    SET "sourceTypeCode" = 'SV'
    FROM "purchases" p
    WHERE ap."sourceType" = 'purchase'
      AND ap."sourceId" = p."id"
      AND p."purchaseType" = 'SERVICIO'
      AND ap."sourceTypeCode" IS NULL
  `;
  return { flete, polloFaenado, compraGeneral, servicio, orphans: 0 };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  console.log(`Backfill AP.sourceTypeCode — ${dryRun ? "DRY-RUN (no escribe)" : "APPLY"}`);

  const before = await countByStatus();
  printBreakdown("Estado actual", before.byBreakdown);
  console.log(`\n  total=${before.total}  withCode=${before.withCode}  nullCode=${before.nullCode}`);

  if (before.nullCode === 0) {
    console.log("\nNada que backfillear — todos los AP ya tienen sourceTypeCode.");
    return;
  }

  const plan = await planCounts();
  console.log(`\nPlan de updates:`);
  console.log(`  FLETE → 'FL':           ${plan.flete}`);
  console.log(`  POLLO_FAENADO → 'PF':   ${plan.polloFaenado}`);
  console.log(`  COMPRA_GENERAL → 'CG':  ${plan.compraGeneral}`);
  console.log(`  SERVICIO → 'SV':        ${plan.servicio}`);
  console.log(`  orphans (quedan NULL):  ${plan.orphans}`);

  if (dryRun) {
    console.log("\n[dry-run] No se escribió nada. Re-correr sin --dry-run para aplicar.");
    return;
  }

  const result = await applyBackfill();
  console.log(`\nAplicado:`);
  console.log(`  FLETE → 'FL':           ${result.flete}`);
  console.log(`  POLLO_FAENADO → 'PF':   ${result.polloFaenado}`);
  console.log(`  COMPRA_GENERAL → 'CG':  ${result.compraGeneral}`);
  console.log(`  SERVICIO → 'SV':        ${result.servicio}`);

  const after = await countByStatus();
  printBreakdown("\nEstado final", after.byBreakdown);
  console.log(`\n  total=${after.total}  withCode=${after.withCode}  nullCode=${after.nullCode}`);
  if (after.nullCode > 0) {
    console.log(`\n[i] ${after.nullCode} filas quedan con sourceTypeCode=NULL — probablemente orphans (Purchase borrado o sourceType != 'purchase'). REQ-GE-5 §5.8: builder usa fallback "DOC".`);
  }
}

// Only run as a script — importing the pure mapping for tests must NOT trigger
// the prisma-backed main() (which would hang/connect in the test runner).
if (process.argv[1]?.includes("backfill-ap-source-type-code")) {
  main()
    .catch((err) => {
      console.error("Error:", err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
