/**
 * PR1 — sale-edit-cascade: IvaBooksService.recomputeFromSaleCascade (RED → GREEN)
 *
 * Tests for the new recomputeFromSaleCascade method on IvaBooksService.
 * Uses a mocked Prisma tx — no DB access.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { IvaBooksService } from "../iva-books.service";

// ── Helpers ───────────────────────────────────────────────────────────────────

const D = (v: string | number) => new Prisma.Decimal(String(v));
const ZERO = D("0");

const ORG_ID = "org-recompute-test";
const SALE_ID = "sale-recompute-test";
const IVA_BOOK_ID = "iva-book-recompute-id";

// ── Base IVA row (all deductions zero — typical case) ─────────────────────────

function makeIvaRow(overrides: Record<string, unknown> = {}) {
  return {
    id: IVA_BOOK_ID,
    organizationId: ORG_ID,
    saleId: SALE_ID,
    importeTotal: D("100.00"),
    importeIce: ZERO,
    importeIehd: ZERO,
    importeIpj: ZERO,
    tasas: ZERO,
    otrosNoSujetos: ZERO,
    exentos: ZERO,
    tasaCero: ZERO,
    codigoDescuentoAdicional: ZERO,
    importeGiftCard: ZERO,
    subtotal: D("100.00"),
    baseIvaSujetoCf: D("100.00"),
    dfIva: D("13.00"),
    dfCfIva: D("13.00"),
    tasaIva: D("0.1300"),
    status: "ACTIVE",
    ...overrides,
  };
}

// ── Mock tx factory ───────────────────────────────────────────────────────────

function makeTx(existingIvaRow: ReturnType<typeof makeIvaRow> | null = makeIvaRow()) {
  const updateMock = vi.fn().mockResolvedValue(existingIvaRow ?? {});
  const findFirstMock = vi.fn().mockResolvedValue(existingIvaRow);

  const tx = {
    ivaSalesBook: {
      findFirst: findFirstMock,
      update: updateMock,
    },
  } as unknown as Prisma.TransactionClient;

  return { tx, findFirstMock, updateMock };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("IvaBooksService.recomputeFromSaleCascade", () => {
  let service: IvaBooksService;

  beforeEach(() => {
    service = new IvaBooksService();
  });

  // ── Test 1: updates importeTotal + recomputed fields, keeps deductions ────

  it("updates importeTotal + recomputed fields, keeps existing deductions unchanged", async () => {
    const { tx, updateMock } = makeTx(makeIvaRow());

    const newTotal = D("200.00");
    await service.recomputeFromSaleCascade(tx, ORG_ID, SALE_ID, newTotal);

    expect(updateMock).toHaveBeenCalledOnce();
    const [{ where, data }] = updateMock.mock.calls[0];

    // Must target the correct IVA book
    expect(where.id).toBe(IVA_BOOK_ID);

    // importeTotal updated
    expect(data.importeTotal.toFixed(2)).toBe("200.00");

    // Recomputed: base = total facturado (alícuota nominal SIN)
    expect(data.baseIvaSujetoCf.toFixed(2)).toBe("200.00");

    // dfIva = 200 × 0.13 = 26.00
    expect(data.dfIva.toFixed(2)).toBe("26.00");

    // dfCfIva same as dfIva (symmetric)
    expect(data.dfCfIva.toFixed(2)).toBe("26.00");

    // subtotal = 200 (no deductions)
    expect(data.subtotal.toFixed(2)).toBe("200.00");

    // tasaIva = 0.13 (constant)
    expect(data.tasaIva.toFixed(2)).toBe("0.13");
  });

  // ── Test 2: zero deductions → base = total (alícuota nominal SIN) ─────────

  it("with zero deductions, baseImponible = total facturado (alícuota nominal SIN Bolivia)", async () => {
    const { tx, updateMock } = makeTx(makeIvaRow({ importeTotal: D("100.00") }));

    await service.recomputeFromSaleCascade(tx, ORG_ID, SALE_ID, D("100.00"));

    expect(updateMock).toHaveBeenCalledOnce();
    const [{ data }] = updateMock.mock.calls[0];

    // base = total = 100
    expect(data.baseIvaSujetoCf.toFixed(2)).toBe("100.00");
    // dfIva = 100 × 0.13 = 13.00
    expect(data.dfIva.toFixed(2)).toBe("13.00");
  });

  // ── Test 3: no IvaSalesBook found → no-op ────────────────────────────────

  it("when no IvaSalesBook is found, returns without throwing or writing", async () => {
    const { tx, updateMock } = makeTx(null);

    await expect(
      service.recomputeFromSaleCascade(tx, ORG_ID, SALE_ID, D("226.00")),
    ).resolves.toBeUndefined();

    expect(updateMock).not.toHaveBeenCalled();
  });
});
