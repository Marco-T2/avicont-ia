/**
 * POC nuevo A3-C3.5 — drop createdBy from mapper deps signature shape (§13.W
 * resolution paired follow-up).
 *
 * Axis: drop unused `createdBy` field across mapper + DTO + sub-mapper export
 * post-A3-C3 GREEN. §13.W material verified pre-recon expand profundo A3-C4:
 *   - SaleList (sale-list.tsx:60-242) consume SOLO `displayCode + contact?.name +
 *     status + date + totalAmount`. NO consume `sale.createdBy`.
 *   - SaleForm (sale-form.tsx:121, 1067-1086) consume `period + receivable.
 *     {amount,allocations,balance} + ivaSalesBook.{id,status} + contact.{name,
 *     nit} + ...campos sale + details`. NO consume `sale.createdBy`.
 *   - HubService SaleServiceForHub interface (hub.service.ts:11-35) NO requiere
 *     `createdBy` (solo id/displayCode/referenceNumber/date/contactId/contact{id,
 *     name,type}/periodId/description/totalAmount/status).
 *   - grep `sale.createdBy\|.createdBy.` features/components/app: VACÍO.
 *
 * Caller-passes-deps cementado A3-C3 fuerza cargar dep que cero consumers leen.
 *
 * Marco lock Q1 (c) §13.W resolution: drop createdBy del mapper deps signature
 * (full drop interpretation d): drop CreatedByRaw type + toCreatedBySummary fn +
 * ToSaleWithDetailsDeps.createdBy field + toSaleWithDetails main result createdBy
 * assignment + SaleWithDetails DTO createdBy field. Mirror precedent A3-C1.5
 * §13.V split commit paired follow-up axis-orthogonal (modificación post-cycle
 * GREEN scope-mod).
 *
 * `Sale.createdById` getter EN ENTITY se preserva (string field) — solo se
 * elimina el nested `createdBy: { id, name, email }` del DTO presentation.
 * `createdById` pass-through via `Omit<Sale, "totalAmount">` continúa intact.
 *
 * Expected failure cumulative (RED justificado, 2 assertions α2 absence-shape
 * mirror A3-C1.5 r5-carve-out-shape 2 β precedent):
 *   - Test 1: mapper file `\bcreatedBy\b` ABSENT (covers CreatedByRaw +
 *     toCreatedBySummary + ToSaleWithDetailsDeps.createdBy + main result
 *     createdBy assignment — pre-GREEN mapper STILL contains all 4 references)
 *   - Test 2: DTO file `\bcreatedBy\b` ABSENT (covers SaleWithDetails.createdBy
 *     field — pre-GREEN DTO STILL contains field)
 *
 * Word boundary `\bcreatedBy\b` regex evita false-positive con `createdById`
 * (suffix `Id` rompe match exacto — verified: `\bcreatedBy\b` NO match
 * `createdById` porque `By` followed by `I` continúa palabra, no boundary).
 *
 * GREEN A3-C3.5 atomic batch β2 (mirror precedent A3-C1.5 GREEN bfd5043):
 *   - Modify mapper.ts (drop 4 createdBy references)
 *   - Modify dto.ts (drop createdBy field)
 *   - Modify c3-mappers-shape.test.ts (drop Test 5 export shape toCreatedBySummary)
 *   - Modify mapper smoke test.ts (drop Test 5 it() + modify Test 8 composite)
 *
 * Self-contained future-proof check (lección A6 #5): shape test asserta paths
 * modules/sale/presentation/* (hex que persiste). NO toca features/{sale,
 * purchase}/* que A3-C7/C8 borran wholesale. Self-contained vs future deletes ✅.
 *
 * Cross-ref:
 * - architecture.md §13.7 lecciones operacionales 9 cementadas
 * - engram bookmark `poc-nuevo/a3/c3-5/locked` Marco locks Q1 (c) §13.W resolution
 * - engram bookmark `poc-nuevo/a3/c3/closed` (#1525) A3-C3 closed cumulative
 * - engram bookmark `poc-nuevo/a3/c1/closed` (#1520) A3-C1.5 §13.V paired precedent
 * - features/dispatch/hub.service.ts:11-35 (SaleServiceForHub interface — NO createdBy)
 * - components/sales/sale-list.tsx:60-242 (SaleList consumer — NO createdBy)
 * - components/sales/sale-form.tsx:121,1067-1086 (SaleForm consumer — NO createdBy)
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const REPO_ROOT = path.resolve(__dirname, "../../../..");

const SALE_MAPPER_PATH = path.join(
  REPO_ROOT,
  "modules/sale/presentation/mappers/sale-to-with-details.mapper.ts",
);

const SALE_DTO_PATH = path.join(
  REPO_ROOT,
  "modules/sale/presentation/dto/sale-with-details.ts",
);

describe("POC nuevo A3-C3.5 — drop createdBy from mapper deps signature shape (§13.W)", () => {
  // ── Test 1: mapper file `createdBy` ABSENT (full drop axis) ────────────────
  //
  // Cubre: CreatedByRaw type export + toCreatedBySummary function export +
  // ToSaleWithDetailsDeps.createdBy field + main result createdBy assignment.
  // Word boundary `\bcreatedBy\b` evita match `createdById` passthrough Sale
  // entity field (sale.createdById preservado en main result).

  it("Test 1: mapper file does NOT contain `createdBy` (full drop axis — 4 references)", () => {
    const source = fs.readFileSync(SALE_MAPPER_PATH, "utf8");
    expect(source).not.toMatch(/\bcreatedBy\b/);
  });

  // ── Test 2: DTO file `createdBy` ABSENT (DTO field drop) ───────────────────
  //
  // Cubre: SaleWithDetails.createdBy: { id, name, email } field. `createdById`
  // preservado via `Omit<Sale, "totalAmount">` pass-through (Prisma type field).

  it("Test 2: SaleWithDetails DTO file does NOT contain `createdBy` field (DTO drop)", () => {
    const source = fs.readFileSync(SALE_DTO_PATH, "utf8");
    expect(source).not.toMatch(/\bcreatedBy\b/);
  });
});
