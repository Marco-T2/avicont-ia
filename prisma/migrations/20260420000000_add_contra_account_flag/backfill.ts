/**
 * Script de backfill idempotente para el campo `isContraAccount` en cuentas existentes.
 *
 * Uso:
 *   npx tsx prisma/migrations/20260420000000_add_contra_account_flag/backfill.ts
 *
 * Acciones:
 *   1. Actualiza cuentas con code="1.2.6" y nombre que contenga "Depreciaci" (case-insensitive)
 *      para que isContraAccount=true y nature=ACREEDORA.
 *   2. Para cada organización que tenga una cuenta "1.2" (Activo No Corriente) pero NO tenga
 *      una cuenta "1.2.8", inserta "Amortización Acumulada" con isContraAccount=true, nature=ACREEDORA.
 *
 * Idempotente: la segunda ejecución no modifica nada ni genera errores.
 *
 * Post-deploy: ejecutar este script DESPUÉS de `prisma migrate deploy`.
 */

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../../generated/prisma/client";

const BATCH_SIZE = 100;

interface Reporte {
  depreciacionFlipped: number;
  amortizacionInserted: number;
  amortizacionSkipped: number;
  amortizacionSkippedDetails: { orgId: string; existingName: string }[];
}

async function main(): Promise<void> {
  const connectionString = `${process.env.DATABASE_URL}`;
  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  const reporte: Reporte = {
    depreciacionFlipped: 0,
    amortizacionInserted: 0,
    amortizacionSkipped: 0,
    amortizacionSkippedDetails: [],
  };

  try {
    console.log("[backfill] Iniciando backfill de isContraAccount...");

    // ── Fase 1: Flip Depreciación Acumulada (1.2.6) ──
    console.log("[backfill] Fase 1: Buscando cuentas Depreciación Acumulada a actualizar...");

    const candidatosDeprec = await prisma.account.findMany({
      where: {
        code: "1.2.6",
        isContraAccount: false,
        name: { contains: "epreciaci", mode: "insensitive" },
      },
      select: { id: true, organizationId: true, name: true },
    });

    console.log(`[backfill] Encontradas ${candidatosDeprec.length} cuentas Depreciación Acumulada para actualizar.`);

    for (let i = 0; i < candidatosDeprec.length; i += BATCH_SIZE) {
      const lote = candidatosDeprec.slice(i, i + BATCH_SIZE);
      await prisma.$transaction(
        lote.map((c) =>
          prisma.account.update({
            where: { id: c.id },
            data: { isContraAccount: true, nature: "ACREEDORA" },
          })
        )
      );
      reporte.depreciacionFlipped += lote.length;
      console.log(`[backfill]   Lote ${Math.floor(i / BATCH_SIZE) + 1}: ${lote.length} cuentas actualizadas.`);
    }

    // ── Fase 2: INSERT Amortización Acumulada (1.2.8) por organización ──
    console.log("[backfill] Fase 2: Buscando organizaciones que necesitan Amortización Acumulada...");

    const parents128 = await prisma.account.findMany({
      where: { code: "1.2" },
      select: { id: true, organizationId: true },
    });

    console.log(`[backfill] Encontradas ${parents128.length} organizaciones con cuenta 1.2.`);

    for (const parent of parents128) {
      const existing128 = await prisma.account.findFirst({
        where: { organizationId: parent.organizationId, code: "1.2.8" },
        select: { id: true, name: true },
      });

      if (existing128) {
        // Si ya existe 1.2.8 con nombre de amortización → ya estaba insertado, skip silencioso
        if (/amortizaci.*acumulada/i.test(existing128.name)) {
          // Ya está correcto — idempotente
          continue;
        }
        // Código ocupado por otro nombre — advertir y saltar
        console.warn(
          `[backfill] SKIP org ${parent.organizationId}: 1.2.8 ocupado por "${existing128.name}".`
        );
        reporte.amortizacionSkipped++;
        reporte.amortizacionSkippedDetails.push({
          orgId: parent.organizationId,
          existingName: existing128.name,
        });
        continue;
      }

      await prisma.account.create({
        data: {
          code: "1.2.8",
          name: "Amortización Acumulada",
          type: "ACTIVO",
          nature: "ACREEDORA",
          subtype: "ACTIVO_NO_CORRIENTE",
          parentId: parent.id,
          level: 3,
          isDetail: true,
          requiresContact: false,
          isActive: true,
          isContraAccount: true,
          organizationId: parent.organizationId,
        },
      });

      reporte.amortizacionInserted++;
    }
  } finally {
    await prisma.$disconnect();
  }

  // ── Reporte final ──
  console.log("\n========== REPORTE DE BACKFILL ==========");
  console.log(`Depreciación Acumulada actualizada: ${reporte.depreciacionFlipped}`);
  console.log(`Amortización Acumulada insertada:   ${reporte.amortizacionInserted}`);
  console.log(`Amortización Acumulada omitida:     ${reporte.amortizacionSkipped}`);

  if (reporte.amortizacionSkippedDetails.length > 0) {
    console.log("\n--- Cuentas omitidas (1.2.8 ocupado) ---");
    for (const d of reporte.amortizacionSkippedDetails) {
      console.log(`  org: ${d.orgId} → "${d.existingName}"`);
    }
  }

  console.log("=========================================\n");
  console.log("[backfill] Backfill completado exitosamente.");
}

main().catch((err) => {
  console.error("[backfill] Error fatal:", err);
  process.exit(1);
});
