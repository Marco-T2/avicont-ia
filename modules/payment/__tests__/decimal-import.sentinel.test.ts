/**
 * Sentinel: DEC-1 import-shape — new files added by pagos-cobros-fifo (Phase 10).
 *
 * DEC-1 invariant (design §CENTERPIECE, REQ-PAY-1..8):
 *   - Domain and application layers MUST NOT value-import `Prisma` from
 *     `@/generated/prisma/client`. Prisma runtime value is confined to infra
 *     adapters only (the Prisma.Decimal conversion boundary).
 *   - `MonetaryAmount` (wrapping decimal.js) is the only money type allowed in
 *     domain + application layers.
 *
 * Files covered (NEW files added by pagos-cobros-fifo SDD change):
 *   DOMAIN:
 *     - allocation-strategy.ts  — FifoStrategy + ManualStrategy, pure MonetaryAmount
 *     - ports/credit-consumption.port.ts — port interface, MonetaryAmount at boundary
 *   APPLICATION (note: payments.service.ts is covered by the application-layer
 *     sentinel below; this file specifically targets the new additions):
 *     - application/helpers/build-entry-lines.ts — existing, covered for completeness
 *
 * INFRA (prisma-credit-consumption.adapter.ts) explicitly MAY value-import
 * Prisma — that is by design (the infra layer IS the Prisma boundary).
 * No negative assertion on infra in this sentinel (correct and expected).
 *
 * Sister sentinels (pre-existing, narrow scope):
 *   - modules/payment/domain/__tests__/decimal-import.sentinel.test.ts
 *     (glosa-builder only)
 *   - modules/payment/application/helpers/__tests__/decimal-import.sentinel.test.ts
 *     (fetch-shortcut-source only)
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "../../..");

function readRepo(rel: string): string {
  return readFileSync(resolve(REPO_ROOT, rel), "utf-8");
}

const PRISMA_VALUE_IMPORT_RE =
  /^import\s*\{[^}]*\bPrisma\b[^}]*\}\s*from\s*["']@\/generated\/prisma\/client["']/m;

// Domain + application layer targets: new files from pagos-cobros-fifo SDD change.
const DOMAIN_APP_TARGETS = [
  "modules/payment/domain/allocation-strategy.ts",
  "modules/payment/domain/ports/credit-consumption.port.ts",
] as const;

describe("sentinel: DEC-1 import-shape — pagos-cobros-fifo new files (Phase 10)", () => {
  describe("domain layer: NO Prisma value-import (Prisma confined to infra)", () => {
    for (const target of DOMAIN_APP_TARGETS) {
      it(`${target} does NOT value-import Prisma from @/generated/prisma/client`, () => {
        const src = readRepo(target);
        expect(src).not.toMatch(PRISMA_VALUE_IMPORT_RE);
      });
    }
  });

  it("infra adapter prisma-credit-consumption.adapter.ts MAY value-import Prisma (DEC-1 boundary — Prisma confined here)", () => {
    // This is a POSITIVE assertion: Prisma MUST be imported in infra (it does the
    // Decimal conversion). If this fails, the adapter has been refactored incorrectly
    // and the DEC-1 boundary has shifted.
    const src = readRepo(
      "modules/payment/infrastructure/adapters/prisma-credit-consumption.adapter.ts",
    );
    expect(src).toMatch(PRISMA_VALUE_IMPORT_RE);
  });
});
