/**
 * Script de backfill idempotente para poblar el campo `subtype` en cuentas existentes.
 *
 * Uso:
 *   npx tsx prisma/migrations/20260413203509_add_account_subtype/backfill.ts
 *
 * Idempotente: solo toca cuentas con `subtype IS NULL`.
 * Segunda ejecución → classified: 0, sin errores.
 */

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../../generated/prisma/client";
import { inferSubtype } from "../../../features/accounting/account-subtype.utils";

// Tamaño del lote para las actualizaciones en batch
const BATCH_SIZE = 100;

interface ReporteBackfill {
  totalNull: number;
  clasificadas: number;
  omitidasRaiz: number;
  noClasificables: number;
  detallesNoClasificables: { code: string; name: string; razon: string }[];
}

async function main(): Promise<void> {
  const connectionString = `${process.env.DATABASE_URL}`;
  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  const reporte: ReporteBackfill = {
    totalNull: 0,
    clasificadas: 0,
    omitidasRaiz: 0,
    noClasificables: 0,
    detallesNoClasificables: [],
  };

  try {
    console.log("[backfill] Iniciando backfill de subtype en cuentas...");

    // Obtener todas las organizaciones que tienen cuentas sin subtype
    const organizaciones = await prisma.account.findMany({
      where: { subtype: null },
      select: { organizationId: true },
      distinct: ["organizationId"],
    });

    if (organizaciones.length === 0) {
      console.log("[backfill] No hay cuentas con subtype NULL. Nada que hacer.");
      return;
    }

    // Procesar por organización para poder resolver parentCode correctamente
    for (const { organizationId } of organizaciones) {
      console.log(`[backfill] Procesando organización: ${organizationId}`);

      // Cargar TODAS las cuentas de la organización para resolver parentCode
      const todasLasCuentas = await prisma.account.findMany({
        where: { organizationId },
        select: { id: true, code: true, parentId: true },
      });

      // Construir mapa id → code para resolver parentCode de forma eficiente
      const idToCode = new Map<string, string>(
        todasLasCuentas.map((c) => [c.id, c.code])
      );

      // Obtener solo las cuentas con subtype NULL de esta organización
      const cuentasSinSubtype = await prisma.account.findMany({
        where: { organizationId, subtype: null },
        select: { id: true, code: true, name: true, type: true, parentId: true },
      });

      reporte.totalNull += cuentasSinSubtype.length;

      // Preparar actualizaciones
      const actualizaciones: { id: string; subtypeInferido: NonNullable<ReturnType<typeof inferSubtype>> }[] = [];

      for (const cuenta of cuentasSinSubtype) {
        const parentCode = cuenta.parentId ? (idToCode.get(cuenta.parentId) ?? null) : null;
        const segmentos = cuenta.code.split(".");

        // Nivel 1 (cuenta raíz estructural): omitir intencionalmente
        if (segmentos.length === 1) {
          reporte.omitidasRaiz++;
          continue;
        }

        const subtypeInferido = inferSubtype(cuenta.code, cuenta.name, parentCode, cuenta.type);

        if (subtypeInferido === null) {
          // No se pudo inferir el subtipo — registrar para análisis
          reporte.noClasificables++;
          reporte.detallesNoClasificables.push({
            code: cuenta.code,
            name: cuenta.name,
            razon: `Sin mapeo en CODE_LEVEL2_TO_SUBTYPE para código nivel 2: ${cuenta.code.split(".").slice(0, 2).join(".")}`,
          });
          continue;
        }

        actualizaciones.push({ id: cuenta.id, subtypeInferido });
      }

      // Ejecutar actualizaciones en lotes de BATCH_SIZE
      for (let i = 0; i < actualizaciones.length; i += BATCH_SIZE) {
        const lote = actualizaciones.slice(i, i + BATCH_SIZE);

        await prisma.$transaction(
          lote.map(({ id, subtypeInferido }) =>
            prisma.account.update({
              where: { id },
              data: { subtype: subtypeInferido },
            })
          )
        );

        reporte.clasificadas += lote.length;
        console.log(
          `[backfill]   Lote ${Math.floor(i / BATCH_SIZE) + 1}: ${lote.length} cuentas actualizadas.`
        );
      }
    }
  } finally {
    await prisma.$disconnect();
  }

  // Imprimir reporte final
  console.log("\n========== REPORTE DE BACKFILL ==========");
  console.log(`Total con subtype NULL:     ${reporte.totalNull}`);
  console.log(`Clasificadas:               ${reporte.clasificadas}`);
  console.log(`Omitidas (raíces nivel 1):  ${reporte.omitidasRaiz}`);
  console.log(`No clasificables:           ${reporte.noClasificables}`);

  if (reporte.detallesNoClasificables.length > 0) {
    console.log("\n--- Cuentas no clasificables ---");
    for (const d of reporte.detallesNoClasificables) {
      console.log(`  [${d.code}] ${d.name} → ${d.razon}`);
    }
  }

  console.log("=========================================\n");

  // Verificar criterio mínimo de clasificación (≥ 95%)
  const cuentasClasificables = reporte.totalNull - reporte.omitidasRaiz;
  if (cuentasClasificables > 0) {
    const porcentaje = (reporte.clasificadas / cuentasClasificables) * 100;
    console.log(
      `[backfill] Porcentaje clasificado: ${porcentaje.toFixed(1)}% (${reporte.clasificadas}/${cuentasClasificables})`
    );
    if (porcentaje < 95) {
      console.warn(
        "[backfill] ADVERTENCIA: clasificación < 95%. Revisar heurística de inferSubtype."
      );
      process.exit(1);
    }
  } else {
    console.log("[backfill] Sin cuentas clasificables (todas son raíces o no hay nulls). OK.");
  }

  console.log("[backfill] Backfill completado exitosamente.");
}

main().catch((err) => {
  console.error("[backfill] Error fatal:", err);
  process.exit(1);
});
