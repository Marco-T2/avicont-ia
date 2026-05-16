/**
 * T-29 — FIN-1 sentinel extension for annual-close-canonical-flow new readers.
 *
 * REQ refs: FIN-1 + REQ-A.1 + REQ-A.2 + REQ-A.4 + REQ-A.11.
 * Cross-ref: spec #2697 FIN-1 preservation note / design #2696 §Infrastructure.
 *
 * Asserts that the 3 NEW INSIDE-TX reader SQL queries filter on
 * `IN ('POSTED','LOCKED')` per FIN-1. The canonical constant
 * `FINALIZED_JE_STATUSES_SQL` is in modules/accounting/shared/domain/; the
 * annual-close adapter uses the literal form for $queryRaw inline (precedent
 * — see aggregateResultAccountsByYear).
 *
 * Structural assertion: the adapter file MUST contain at minimum 3 occurrences
 * of `je.status            IN ('POSTED','LOCKED')` (or equivalent line),
 * one per new reader method.
 *
 * Also extends the existing DEC-1 sentinel coverage by asserting the 5 new
 * builder files exist under modules/annual-close/application/ — they're
 * automatically scanned by decimal-import.sentinel.test.ts (which walks
 * application/ recursively for .ts), but this structural assertion ensures
 * the coverage is not silently lost on a future refactor.
 */

import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const MODULE_ROOT = resolve(__dirname, "../..");

const ADAPTER_PATH = resolve(
  MODULE_ROOT,
  "infrastructure/prisma-year-accounting-reader-tx.adapter.ts",
);

const NEW_BUILDERS = [
  "gastos-close-line.builder.ts",
  "ingresos-close-line.builder.ts",
  "resultado-close-line.builder.ts",
  "balance-close-line.builder.ts",
  "apertura-line.builder.ts",
] as const;

const NEW_READER_METHODS = [
  "aggregateGastosByYear",
  "aggregateIngresosByYear",
  "aggregateBalanceSheetAtYearEnd",
] as const;

describe("FIN-1 sentinel — new annual-close reader methods preserve POSTED+LOCKED filter", () => {
  it("adapter exists at expected path", () => {
    expect(existsSync(ADAPTER_PATH)).toBe(true);
  });

  it("each new reader method body contains the FIN-1 POSTED+LOCKED status filter", () => {
    const src = readFileSync(ADAPTER_PATH, "utf8");
    for (const method of NEW_READER_METHODS) {
      const methodIdx = src.indexOf(`async ${method}(`);
      expect(methodIdx).toBeGreaterThan(-1);
      // Take a 2000-char slice starting at the method signature; should
      // include the SQL body comfortably.
      const slice = src.slice(methodIdx, methodIdx + 2000);
      expect(slice).toMatch(/IN\s*\(\s*'POSTED'\s*,\s*'LOCKED'\s*\)/);
    }
  });
});

describe("DEC-1 sentinel extension — new builders exist + are auto-scanned", () => {
  it("all 5 new builder files exist (auto-scanned by decimal-import.sentinel)", () => {
    for (const b of NEW_BUILDERS) {
      const p = resolve(MODULE_ROOT, "application", b);
      expect(existsSync(p)).toBe(true);
    }
  });
});
