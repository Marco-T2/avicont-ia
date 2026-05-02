/**
 * POC nuevo A3-C3 — sale presentation mappers shape (build presentation/mappers
 * caller-passes-deps pattern §13.T resolution preparation).
 *
 * Axis: build modules/sale/presentation/mappers/sale-to-with-details.mapper.ts
 * con 6 exports puros post-A3-C3.5 §13.W drop createdBy (1 utility
 * computeDisplayCode + 4 sub-mappers passthrough/conversion + 1 main
 * toSaleWithDetails compositor caller-passes-deps). Pattern
 * caller-passes-deps FORZADO por hex PrismaSaleRepository include scope =
 * `{ details only }` — Sale entity hidratada SIN source material para
 * SaleWithDetails (contact, period, createdBy, receivable, ivaSalesBook).
 * Caller (page) DEBE cargar deps separadas via otros repos y pasar al mapper.
 *
 * Marco locks SubQ-a–h pre-RED (engram poc-nuevo/a3/c3/locked):
 *   - SubQ-a (A) caller-passes-deps: única coherente Q1 ζ + hex purity
 *   - SubQ-b distinct sub-mappers exported (testable individual + composable)
 *   - SubQ-c standalone computeDisplayCode exported (DRY A3-C5 HubService inline)
 *   - SubQ-d throw Error para sequenceNumber null (fail-fast surface real bugs)
 *   - SubQ-e 1 file cohesive (mirror precedent dto/sale-with-details.ts)
 *   - SubQ-f 8 assertions α RED (1 file existence + 7 export shape) — post
 *     A3-C3.5 §13.W drop createdBy: 7 assertions (1 file + 6 export shape)
 *   - SubQ-g 8 it() blocks GREEN smoke (7 sub-mapper + 1 displayCode null edge)
 *     — post A3-C3.5: 7 it() blocks (6 sub-mapper + 1 displayCode null edge)
 *   - SubQ-h DEFER purchase mappers a sub-fase futura paired follow-up
 *
 * Asimetría material §13.T verificada A3-C3 pre-recon:
 *   - Hex SaleService.list/getById return Sale[]/Sale (domain entity)
 *   - Sale entity NO tiene displayCode + nested contact/period/createdBy/
 *     receivable/ivaSalesBook (sale.entity.ts:19-38 SaleProps)
 *   - Legacy retorna SaleWithDetails con TODO nested via Prisma include
 *     (features/sale/sale.repository.ts:30-58 saleInclude shape source completo)
 *   - Consumers SaleList (sale-list.tsx:60) + SaleForm (sale-form.tsx:36) +
 *     HubService SaleServiceForHub (hub.service.ts:11-35) requieren shape
 *     SaleWithDetails
 *   - Cutover directo `new SaleService()` → `makeSaleService()` ROMPE 4 callers
 *     project-scope estructuralmente — A3-C3 build mappers es precondición
 *     A3-C4 cutover 2 sale pages + A3-C5 cutover 2 HubService deps
 *
 * Expected failure cumulative (RED justificado, 8 assertions α file existence × 1
 * + export shape × 7) — post A3-C3.5 §13.W drop createdBy: 7 assertions (1 + 6):
 *
 * A3-C3 RED (Tests 1-8, GREEN al cierre A3-C3) — Tests 1-7 post A3-C3.5:
 *   - Test 1 file existence: sale-to-with-details.mapper.ts NO existe
 *     (mapper module nuevo). GREEN A3-C3 sub-paso 1 build file con 6 exports
 *     post drop createdBy.
 *   - Tests 2-7 export shape: 6 symbols requeridos
 *     (computeDisplayCode + toContactSummary + toPeriodSummary +
 *      toReceivableSummary + toSaleDetailRow + toSaleWithDetails main —
 *      toCreatedBySummary dropeado A3-C3.5 §13.W resolution).
 *
 * Self-contained future-proof check (lección A6 #5): shape test asserta paths
 * modules/sale/presentation/mappers/* (hex que persiste). NO toca features/{sale,
 * purchase}/* que A3-C7/C8 borran wholesale. Self-contained vs future deletes ✅.
 *
 * Source-string assertion pattern: mirror `asymmetry-shape.poc-nuevo-a3.test.ts`
 * (A3-C1 RED precedent — file existence + export shape mirror sale precedent
 * simétrico). Regex export shape flexible `(function|const)` para tolerar GREEN
 * implementation freedom (function declaration vs const arrow). Coupling
 * intencional al name binding, NO a la sintaxis de declaración.
 *
 * §13.V resolution preserved: mappers son TS puros (NO Prisma type runtime
 * imports directos en mapper module). Sub-mappers reciben passthrough shapes
 * definidos por SaleWithDetails dto. NO R5 violation surface esperada (ESLint
 * dry-run pre-RED 4 callers CLEAN confirma — lección #10 candidate 3ra evidencia
 * cumulative cross-ciclos: A3-C1.5 §13.V resolution + A3-C2 cutover preserved +
 * A3-C3 dry-run target callers clean).
 *
 * Cross-ref:
 * - architecture.md §13.T DTO shape divergence Sale entity vs SaleWithDetails
 * - architecture.md §13.7 lecciones operacionales 9 cementadas
 * - engram bookmark `poc-nuevo/a3/c3/locked` Marco locks Q1-Q6 + SubQ-a–h
 * - engram bookmark `poc-nuevo/a3/c2/closed` (#1522) A3-C2 cutover precedent
 * - engram bookmark `poc-nuevo/a3/c1/closed` (#1520) A3-C1 build hex precedent simétrico
 * - features/sale/sale.repository.ts:30-58 (legacy saleInclude shape source completo)
 * - features/sale/sale.service.ts:124-130 (legacy withDisplayCode pattern reference)
 * - features/sale/sale.utils.ts:getDisplayCode (computeDisplayCode formula `VG-NNN`)
 * - modules/sale/presentation/dto/sale-with-details.ts (target shape destination)
 * - modules/sale/infrastructure/prisma-sale.repository.ts:50-72 (hex include asimetría confirmada)
 * - modules/sale/application/sale.service.ts:94-105 (hex .list/.getById return Sale entity)
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const REPO_ROOT = path.resolve(__dirname, "../../../..");

const SALE_MAPPER_PATH = path.join(
  REPO_ROOT,
  "modules/sale/presentation/mappers/sale-to-with-details.mapper.ts",
);

describe("POC nuevo A3-C3 — sale presentation mappers shape", () => {
  // ── File existence (Test 1) ─────────────────────────────────────────────────

  it("Test 1: modules/sale/presentation/mappers/sale-to-with-details.mapper.ts exists (mapper module build)", () => {
    expect(fs.existsSync(SALE_MAPPER_PATH)).toBe(true);
  });

  // ── Export shape × 7 (Tests 2-8) — caller-passes-deps mapper symbols ────────

  it("Test 2: mapper exports computeDisplayCode (utility VG-NNN, DRY A3-C5 HubService inline)", () => {
    const source = fs.readFileSync(SALE_MAPPER_PATH, "utf8");
    expect(source).toMatch(/export\s+(?:function|const)\s+computeDisplayCode\b/);
  });

  it("Test 3: mapper exports toContactSummary (sub-mapper passthrough)", () => {
    const source = fs.readFileSync(SALE_MAPPER_PATH, "utf8");
    expect(source).toMatch(/export\s+(?:function|const)\s+toContactSummary\b/);
  });

  it("Test 4: mapper exports toPeriodSummary (sub-mapper passthrough)", () => {
    const source = fs.readFileSync(SALE_MAPPER_PATH, "utf8");
    expect(source).toMatch(/export\s+(?:function|const)\s+toPeriodSummary\b/);
  });

  it("Test 5: mapper exports toReceivableSummary (sub-mapper Decimal→number + nested allocations)", () => {
    const source = fs.readFileSync(SALE_MAPPER_PATH, "utf8");
    expect(source).toMatch(/export\s+(?:function|const)\s+toReceivableSummary\b/);
  });

  it("Test 6: mapper exports toSaleDetailRow (sub-mapper MonetaryAmount/Decimal→number)", () => {
    const source = fs.readFileSync(SALE_MAPPER_PATH, "utf8");
    expect(source).toMatch(/export\s+(?:function|const)\s+toSaleDetailRow\b/);
  });

  it("Test 7: mapper exports toSaleWithDetails (main compositor caller-passes-deps)", () => {
    const source = fs.readFileSync(SALE_MAPPER_PATH, "utf8");
    expect(source).toMatch(/export\s+(?:function|const)\s+toSaleWithDetails\b/);
  });
});
