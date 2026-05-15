import Decimal from "decimal.js";

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
 *
 * Backed by `decimal.js@10.6.0` direct dep (post-oleada-money-decimal-hex-purity
 * sub-POC 1+). The runtime instance is identical: Prisma.Decimal IS the
 * same `decimal.js` class re-exported through the Prisma namespace; this
 * swap drops the Prisma value-import to keep this file off the client
 * bundle's `node:module` blast radius even though the file itself is
 * server-only — sister to sub-POCs 2/3/4 migrations.
 */
export const TASA_IVA = new Decimal("0.1300");
