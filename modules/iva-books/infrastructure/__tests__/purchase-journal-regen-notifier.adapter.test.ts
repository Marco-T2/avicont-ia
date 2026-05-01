import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  PurchaseService,
  UpdatePurchaseResult,
} from "@/modules/purchase/application/purchase.service";

import { PurchaseJournalRegenNotifierAdapter } from "../purchase-journal-regen-notifier.adapter";

/**
 * Mock-del-colaborador test for PurchaseJournalRegenNotifierAdapter (POC #11.0c
 * A3 C5 RED Round 1). Cross-module bridge IVA-hex → purchase-hex use case wrap.
 * Mirror simétrico C4 SaleJournalRegenNotifierAdapter.
 *
 * Adapter contract (`purchase-journal-regen-notifier.port.ts`):
 *   - Wraps `PurchaseService.regenerateJournalForIvaChange(orgId, purchaseId, userId)`.
 *   - Narrows `UpdatePurchaseResult { purchase, correlationId }` → `{ correlationId }`
 *     per §12 cross-module concrete leak avoidance (NO `Purchase` aggregate leak).
 *   - D-A1#3 — purchase-hex maneja su propia tx vía `PurchaseUoW.run()`; bridge
 *     call es side-effect cross-module fuera del `IvaBookScope`.
 *   - Asimetría con C4 sale-hex: purchase-hex VALIDA periodo INSIDE use case
 *     (`purchase.service.ts:1098-1104` throws `PurchasePeriodClosed`). IVA-hex
 *     consumer replica gate en su lado per D-A1#4 elevation. Adapter propaga
 *     throw transparente (NO catch / NO re-wrap) — test #4 lockea identity.
 *
 * §12.2 prefix decision (sin prefijo): wrappea port de otro módulo ya migrado
 * (`modules/purchase/application` hex). Mirror precedent `contacts-read.adapter.ts`
 * per docs/architecture.md:529 (verificado textual durante C4). NO `prisma-`
 * (precedent A1 `PrismaIvaBookRegenNotifierAdapter` SÍ toca Prisma directo —
 * semántica estricta §12.2).
 *
 * Mocking strategy (`feedback/mock-hygiene-commit-scope`): `vi.fn()` stub
 * mínimo del shape `PurchaseService` cast `as unknown as PurchaseService` — NO
 * `vi.mock` declarations. PurchaseService es DI-inyectado vía constructor
 * flexible (mirror A1+C2+C3+C4); no hay módulo import a mockear.
 *
 * Aspirational mock check (`feedback/aspirational-mock-signals-unimplemented-contract`):
 * `PurchaseService.regenerateJournalForIvaChange` está implementado en
 * `modules/purchase/application/purchase.service.ts:1073` y verificado por sus
 * propios tests. El stub testea narrow + pass-through del wrapper IVA-hex,
 * NO el contrato del purchase-hex use case. NO aspirational.
 *
 * RED honesty preventivo (`feedback/red-acceptance-failure-mode`): TODOS los
 * `it()` FAIL pre-implementación por module resolution failure
 * (`PurchaseJournalRegenNotifierAdapter` no existe en `infrastructure/`).
 * Failure mode declarado lock C5: "1 suite failed Cannot find module
 * '../purchase-journal-regen-notifier.adapter', 0 tests ran". Post-GREEN:
 * PASSES cuando el adapter delega a `purchaseService.regenerateJournalForIvaChange`
 * y narrow al shape `{ correlationId }`.
 */

const SOURCE_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../purchase-journal-regen-notifier.adapter.ts",
);

function makePurchaseServiceStub(): {
  purchaseService: PurchaseService;
  regenerate: ReturnType<typeof vi.fn>;
} {
  const regenerate = vi.fn();
  const purchaseService = {
    regenerateJournalForIvaChange: regenerate,
  } as unknown as PurchaseService;
  return { purchaseService, regenerate };
}

function makeUpdatePurchaseResult(correlationId: string): UpdatePurchaseResult {
  // Purchase aggregate stub — el adapter NO debe leakear este field.
  // Discriminante único `__purchase_leak_marker__` permite assert de ausencia
  // en el return shape.
  const purchase = {
    id: "purchase-c5-001",
    __purchase_leak_marker__: "MUST_NOT_LEAK",
  } as unknown as UpdatePurchaseResult["purchase"];
  return { purchase, correlationId };
}

describe("PurchaseJournalRegenNotifierAdapter — wrap-thin IVA→purchase-hex con narrow + DI flexible", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("regenerateJournalForIvaChange: invokes purchaseService with exact args (orgId, purchaseId, userId)", async () => {
    // Discriminantes elegidos para detectar arg swap / mapping cruzado:
    //   orgId="org-c5-bridge", purchaseId="purchase-c5-001", userId="u-c5-marco".
    // Si el adapter cruzara args (p.ej. purchaseService.regen(purchaseId, orgId, userId)),
    // el `toHaveBeenCalledWith` los detectaría intercambiados bit-exact.
    const { purchaseService, regenerate } = makePurchaseServiceStub();
    regenerate.mockResolvedValue(makeUpdatePurchaseResult("corr-c5-args-3df"));

    const adapter = new PurchaseJournalRegenNotifierAdapter(purchaseService);
    await adapter.regenerateJournalForIvaChange(
      "org-c5-bridge",
      "purchase-c5-001",
      "u-c5-marco",
    );

    expect(regenerate).toHaveBeenCalledTimes(1);
    expect(regenerate).toHaveBeenCalledWith(
      "org-c5-bridge",
      "purchase-c5-001",
      "u-c5-marco",
    );
  });

  it("regenerateJournalForIvaChange: returns narrow { correlationId } extracted from UpdatePurchaseResult", async () => {
    const { purchaseService, regenerate } = makePurchaseServiceStub();
    regenerate.mockResolvedValue(makeUpdatePurchaseResult("corr-c5-fixed-8e2"));

    const adapter = new PurchaseJournalRegenNotifierAdapter(purchaseService);
    const result = await adapter.regenerateJournalForIvaChange(
      "org-c5-bridge",
      "purchase-c5-001",
      "u-c5-marco",
    );

    expect(result).toEqual({ correlationId: "corr-c5-fixed-8e2" });
  });

  it("regenerateJournalForIvaChange: NO leak de purchase field en return shape (concrete leak avoidance §12)", async () => {
    // Lockeo §12 cross-module concrete leak avoidance: el `Purchase` aggregate
    // del UpdatePurchaseResult NO debe filtrarse al port consumer (IVA-hex).
    // Discriminante `__purchase_leak_marker__` único en el purchase stub — si
    // el adapter retornara `result` o spread `...result`, el marker aparecería
    // en el return y el assert lo detectaría.
    const { purchaseService, regenerate } = makePurchaseServiceStub();
    regenerate.mockResolvedValue(makeUpdatePurchaseResult("corr-c5-leak-1a4"));

    const adapter = new PurchaseJournalRegenNotifierAdapter(purchaseService);
    const result = await adapter.regenerateJournalForIvaChange(
      "org-c5-bridge",
      "purchase-c5-001",
      "u-c5-marco",
    );

    expect(Object.keys(result)).toEqual(["correlationId"]);
    expect(result).not.toHaveProperty("purchase");
    expect(JSON.stringify(result)).not.toContain("__purchase_leak_marker__");
  });

  it("regenerateJournalForIvaChange: propagates purchaseService throw without re-wrap (same instance)", async () => {
    // RED honesty: pass-through bit-exact del throw del use case purchase-hex.
    // Cubre el caso `PurchasePeriodClosed` que el use case lanza inside
    // (asimetría con sale-hex per port JSDoc :11-14): el adapter NO debe
    // discriminar tipos ni re-wrappear, propaga el MISMO instance transparente.
    // `.rejects.toBe(originalError)` (identity, no `.toBeInstanceOf`) lockea
    // propagación del MISMO instance, no una clase distinta.
    const { purchaseService, regenerate } = makePurchaseServiceStub();
    const originalError = new Error("purchase-hex regenerate failed");
    regenerate.mockRejectedValue(originalError);

    const adapter = new PurchaseJournalRegenNotifierAdapter(purchaseService);

    await expect(
      adapter.regenerateJournalForIvaChange(
        "org-c5-bridge",
        "purchase-c5-001",
        "u-c5-marco",
      ),
    ).rejects.toBe(originalError);
    expect(regenerate).toHaveBeenCalledTimes(1);
  });

  it("constructor flexible — accepts PurchaseService instance via DI (mirror A1+C2+C3+C4 precedent)", () => {
    // Lockeo constructor flexible vs module-singleton (precedent contacts-read
    // usa singleton module-level; A1+C2+C3+C4 IVA-books usan DI). C5 hereda DI
    // porque purchaseService es hex-migrated, no legacy. Este test detecta si
    // el adapter regresa a singleton (constructor sin args) — el `new ...(stub)`
    // throwearía o el adapter ignoraría el arg.
    const { purchaseService } = makePurchaseServiceStub();
    const adapter = new PurchaseJournalRegenNotifierAdapter(purchaseService);
    expect(adapter).toBeInstanceOf(PurchaseJournalRegenNotifierAdapter);
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
