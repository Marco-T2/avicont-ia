import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SaleService, UpdateSaleResult } from "@/modules/sale/application/sale.service";

import { SaleJournalRegenNotifierAdapter } from "../sale-journal-regen-notifier.adapter";

/**
 * Mock-del-colaborador test for SaleJournalRegenNotifierAdapter (POC #11.0c
 * A3 C4 RED Round 1). Cross-module bridge IVA-hex → sale-hex use case wrap.
 *
 * Adapter contract (`sale-journal-regen-notifier.port.ts`):
 *   - Wraps `SaleService.regenerateJournalForIvaChange(orgId, saleId, userId)`.
 *   - Narrows `UpdateSaleResult { sale, correlationId }` → `{ correlationId }`
 *     per §12 cross-module concrete leak avoidance (NO `Sale` aggregate leak).
 *   - D-A1#3 — sale-hex maneja su propia tx vía `SaleUoW.run()`; bridge call
 *     es side-effect cross-module fuera del `IvaBookScope`.
 *   - D-A1#4 — period gate NO valida aquí; vive en el consumer
 *     (`applyBridgeNotifyIfPosted` en iva-book.service.ts:776-791).
 *
 * §12.2 prefix decision (sin prefijo): wrappea port de otro módulo ya
 * migrado (`modules/sale/application` hex). Mirror precedent
 * `contacts-read.adapter.ts` per docs/architecture.md:529. NO `prisma-`
 * (precedent A1 `PrismaIvaBookRegenNotifierAdapter` SÍ toca Prisma directo
 * `tx.ivaSalesBook.findFirst:44` — semántica estricta §12.2).
 *
 * Mocking strategy (`feedback/mock-hygiene-commit-scope`): `vi.fn()` stub
 * mínimo del shape `SaleService` cast `as unknown as SaleService` — NO
 * `vi.mock` declarations. SaleService es DI-inyectado vía constructor
 * flexible (mirror A1+C2+C3); no hay módulo import a mockear.
 *
 * Aspirational mock check (`feedback/aspirational-mock-signals-unimplemented-contract`):
 * `SaleService.regenerateJournalForIvaChange` está implementado en
 * `modules/sale/application/sale.service.ts:939` y verificado por sus
 * propios tests. El stub testea narrow + pass-through del wrapper IVA-hex,
 * NO el contrato del sale-hex use case. NO aspirational.
 *
 * RED honesty preventivo (`feedback/red-acceptance-failure-mode`): TODOS los
 * `it()` FAIL pre-implementación por module resolution failure
 * (`SaleJournalRegenNotifierAdapter` no existe en `infrastructure/`).
 * Failure mode declarado lock C4: "1 suite failed Cannot find module
 * '../sale-journal-regen-notifier.adapter', 0 tests ran". Post-GREEN:
 * PASSES cuando el adapter delega a `saleService.regenerateJournalForIvaChange`
 * y narrow al shape `{ correlationId }`.
 */

const SOURCE_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../sale-journal-regen-notifier.adapter.ts",
);

function makeSaleServiceStub(): {
  saleService: SaleService;
  regenerate: ReturnType<typeof vi.fn>;
} {
  const regenerate = vi.fn();
  const saleService = {
    regenerateJournalForIvaChange: regenerate,
  } as unknown as SaleService;
  return { saleService, regenerate };
}

function makeUpdateSaleResult(correlationId: string): UpdateSaleResult {
  // Sale aggregate stub — el adapter NO debe leakear este field. Discriminante
  // único `__sale_leak_marker__` permite assert de ausencia en el return shape.
  const sale = {
    id: "sale-c4-001",
    __sale_leak_marker__: "MUST_NOT_LEAK",
  } as unknown as UpdateSaleResult["sale"];
  return { sale, correlationId };
}

describe("SaleJournalRegenNotifierAdapter — wrap-thin IVA→sale-hex con narrow + DI flexible", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("regenerateJournalForIvaChange: invokes saleService with exact args (orgId, saleId, userId)", async () => {
    // Discriminantes elegidos para detectar arg swap / mapping cruzado:
    //   orgId="org-c4-bridge", saleId="sale-c4-001", userId="u-c4-marco".
    // Si el adapter cruzara args (p.ej. saleService.regen(saleId, orgId, userId)),
    // el `toHaveBeenCalledWith` los detectaría intercambiados bit-exact.
    const { saleService, regenerate } = makeSaleServiceStub();
    regenerate.mockResolvedValue(makeUpdateSaleResult("corr-c4-args-7af"));

    const adapter = new SaleJournalRegenNotifierAdapter(saleService);
    await adapter.regenerateJournalForIvaChange(
      "org-c4-bridge",
      "sale-c4-001",
      "u-c4-marco",
    );

    expect(regenerate).toHaveBeenCalledTimes(1);
    expect(regenerate).toHaveBeenCalledWith(
      "org-c4-bridge",
      "sale-c4-001",
      "u-c4-marco",
    );
  });

  it("regenerateJournalForIvaChange: returns narrow { correlationId } extracted from UpdateSaleResult", async () => {
    const { saleService, regenerate } = makeSaleServiceStub();
    regenerate.mockResolvedValue(makeUpdateSaleResult("corr-c4-fixed-9b3"));

    const adapter = new SaleJournalRegenNotifierAdapter(saleService);
    const result = await adapter.regenerateJournalForIvaChange(
      "org-c4-bridge",
      "sale-c4-001",
      "u-c4-marco",
    );

    expect(result).toEqual({ correlationId: "corr-c4-fixed-9b3" });
  });

  it("regenerateJournalForIvaChange: NO leak de sale field en return shape (concrete leak avoidance §12)", async () => {
    // Lockeo §12 cross-module concrete leak avoidance: el `Sale` aggregate
    // del UpdateSaleResult NO debe filtrarse al port consumer (IVA-hex).
    // Discriminante `__sale_leak_marker__` único en el sale stub — si el
    // adapter retornara `result` o spread `...result`, el marker aparecería
    // en el return y el assert lo detectaría.
    const { saleService, regenerate } = makeSaleServiceStub();
    regenerate.mockResolvedValue(makeUpdateSaleResult("corr-c4-leak-2c1"));

    const adapter = new SaleJournalRegenNotifierAdapter(saleService);
    const result = await adapter.regenerateJournalForIvaChange(
      "org-c4-bridge",
      "sale-c4-001",
      "u-c4-marco",
    );

    expect(Object.keys(result)).toEqual(["correlationId"]);
    expect(result).not.toHaveProperty("sale");
    expect(JSON.stringify(result)).not.toContain("__sale_leak_marker__");
  });

  it("regenerateJournalForIvaChange: propagates saleService throw without re-wrap (same instance)", async () => {
    // RED honesty: pass-through bit-exact del throw del use case sale-hex.
    // Guard contra refactors futuros que introduzcan try/catch + re-wrap o
    // swallow. `.rejects.toBe(originalError)` (identity, no `.toBeInstanceOf`)
    // lockea propagación del MISMO instance, no una clase distinta.
    const { saleService, regenerate } = makeSaleServiceStub();
    const originalError = new Error("sale-hex regenerate failed");
    regenerate.mockRejectedValue(originalError);

    const adapter = new SaleJournalRegenNotifierAdapter(saleService);

    await expect(
      adapter.regenerateJournalForIvaChange(
        "org-c4-bridge",
        "sale-c4-001",
        "u-c4-marco",
      ),
    ).rejects.toBe(originalError);
    expect(regenerate).toHaveBeenCalledTimes(1);
  });

  it("constructor flexible — accepts SaleService instance via DI (mirror A1+C2+C3 precedent)", () => {
    // Lockeo constructor flexible vs module-singleton (precedent contacts-read
    // usa singleton module-level; A1+C2+C3 IVA-books usan DI). C4 hereda DI
    // porque saleService es hex-migrated, no legacy. Este test detecta si el
    // adapter regresa a singleton (constructor sin args) — el `new ...(stub)`
    // throwearía o el adapter ignoraría el arg.
    const { saleService } = makeSaleServiceStub();
    const adapter = new SaleJournalRegenNotifierAdapter(saleService);
    expect(adapter).toBeInstanceOf(SaleJournalRegenNotifierAdapter);
  });

  it("source code: NO toca Prisma directo — ausencia de Prisma imports (§12.2 sin prefijo lock)", () => {
    // Lock §12.2 estructural: el adapter sin prefijo NO debe importar Prisma
    // (ni `@/generated/prisma/client` ni referencias `Prisma.X`). Si lo hiciera,
    // §12.2 exige el prefix `prisma-`. Este test es static source check —
    // RED falla por module resolution (suite no monta). Post-GREEN: el archivo
    // existe + no contiene imports Prisma → PASSES. Si futuro refactor agrega
    // un Prisma import, este test detecta + fuerza re-decisión §12.2 prefix.
    const source = readFileSync(SOURCE_PATH, "utf8");
    expect(source).not.toMatch(/from\s+["']@\/generated\/prisma/);
    expect(source).not.toMatch(/\bPrisma\./);
  });
});
