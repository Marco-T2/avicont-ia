import { Prisma } from "@/generated/prisma/client";

/**
 * Alícuota IVA Bolivia 13% — exported para consumo cross-module legacy↔hex
 * bridge (POC #11.0c A4-c C2 GREEN P3.4 lock Marco): mapper hex
 * `IvaSalesBookEntry → IvaSalesBookDTO` requiere `tasaIva: Decimal` campo
 * que NO existe en `IvaCalcResult` VO (solo subtotal/baseImponible/ivaAmount).
 * Single source of truth post-A2-C1 migration (POC siguiente) — TASA_IVA
 * migrado del legacy `iva-books.service.ts:25` aquí (semánticamente acoplado
 * a `calcTotales` — ambos cálculo IVA cohesivos en el mismo archivo). Valor
 * textual `"0.1300"` preserve P3.4 source-text lock (drop trailing zero
 * silently equivalente runtime via Decimal.js normalize, pero pierde el lock
 * textual que cementa la alícuota canonical 4-decimales SIN Bolivia).
 *
 * RELOCATED from features/accounting/iva-books/iva-calc.utils.ts (POC
 * #5/8 OLEADA 6 — features wholesale delete C2). Layer: presentation
 * (legacy-bridge — Decimal de boundary, NOT domain math). Coexists with
 * `modules/iva-books/domain/compute-iva-totals.ts` numeric `TASA_IVA = 0.13`
 * (different layer, different type — IVA-D2 dual constant lock).
 */
export const TASA_IVA = new Prisma.Decimal("0.1300");
