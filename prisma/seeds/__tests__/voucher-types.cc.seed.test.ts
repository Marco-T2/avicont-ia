/**
 * Phase 1.5 RED — CC voucher type ("Comprobante de Cierre") seed assertion.
 *
 * Asserts that after `seedVoucherTypes(orgId)` runs against a fresh org, a
 * row with code "CC", prefix "C", name "Comprobante de Cierre", and
 * isAdjustment=true is upserted. The CC type is the source of all
 * year-close journal entries (REQ-3.1 / REQ-3.2).
 *
 * Pattern mirrors voucher-types.seed.test.ts — pure mock-Prisma upsert
 * inspection, no DB connection. Declared failure mode (Phase 1.5 RED):
 * the DEFAULT_VOUCHER_TYPES constant currently has 12 entries (CI, CE,
 * CD, CJ, CT, CA, CN, CM, CB, CP, CL, CV) — CC is absent. The CC entry
 * is added in Phase 1.6 GREEN.
 *
 * Covers spec REQ-3.1.
 */
import { describe, it, expect, vi } from "vitest";
import {
  DEFAULT_VOUCHER_TYPES,
  seedVoucherTypes,
} from "../voucher-types";

type UpsertCall = {
  where: { organizationId_code: { organizationId: string; code: string } };
  create: {
    organizationId: string;
    code: string;
    prefix: string;
    name: string;
    description?: string;
    isAdjustment: boolean;
  };
  update: Record<string, unknown>;
};

function makeMockPrisma() {
  const upsert = vi.fn(async (args: UpsertCall) => ({
    id: `id-${args.create.code}`,
    ...args.create,
  }));
  return {
    upsert,
    client: {
      voucherTypeCfg: { upsert },
      $disconnect: vi.fn(async () => undefined),
    },
  };
}

describe("Phase 1.5 — CC voucher type seed (REQ-3.1)", () => {
  it("DEFAULT_VOUCHER_TYPES includes a CC entry", () => {
    const cc = DEFAULT_VOUCHER_TYPES.find((t) => t.code === "CC");
    expect(cc).toBeDefined();
  });

  it("CC entry has prefix='C', name='Comprobante de Cierre', isAdjustment=true", () => {
    const cc = DEFAULT_VOUCHER_TYPES.find((t) => t.code === "CC");
    expect(cc).toBeDefined();
    expect(cc!.prefix).toBe("C");
    expect(cc!.name).toBe("Comprobante de Cierre");
    expect(cc!.isAdjustment).toBe(true);
  });

  it("seedVoucherTypes upserts the CC row against the org", async () => {
    const mock = makeMockPrisma();
    await seedVoucherTypes("org-cc-test", mock.client as never);
    const ccCall = mock.upsert.mock.calls
      .map((c) => c[0] as UpsertCall)
      .find((c) => c.create.code === "CC");
    expect(ccCall, "expected one upsert call for code=CC").toBeDefined();
    expect(ccCall!.create.organizationId).toBe("org-cc-test");
    expect(ccCall!.create.prefix).toBe("C");
    expect(ccCall!.create.name).toBe("Comprobante de Cierre");
    expect(ccCall!.create.isAdjustment).toBe(true);
    expect(ccCall!.update).toEqual({}); // idempotency — no mutation on re-seed
  });
});
