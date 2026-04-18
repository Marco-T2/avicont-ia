/**
 * T1.1 RED → T1.4 GREEN
 * REQ-D.1 — Seed creates 8 standard voucher types per org, idempotent, prefix-backed
 *
 * D.1-S1 fresh org → 8 rows
 * D.1-S2 idempotent — re-run → no duplicates (upsert semantics)
 * D.1-S3 every seed entry has a non-empty prefix
 * D.1-S4 seed file text does NOT import VoucherTypeCode enum
 */

import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  DEFAULT_VOUCHER_TYPES,
  seedVoucherTypes,
} from "../voucher-types";

// ── Fixtures ──

const EXPECTED_CODES = ["CI", "CE", "CD", "CT", "CA", "CN", "CM", "CB"] as const;
const EXPECTED_PREFIXES: Record<string, string> = {
  CI: "I",
  CE: "E",
  CD: "D",
  CT: "T",
  CA: "A",
  CN: "N",
  CM: "M",
  CB: "B",
};

// Minimal Prisma-shape mock — we only exercise voucherTypeCfg.upsert + $disconnect
type UpsertArgs = {
  where: { organizationId_code: { organizationId: string; code: string } };
  create: { organizationId: string; code: string; prefix: string; name: string; description?: string };
  update: Record<string, unknown>;
};

function makeMockPrisma() {
  const upsert = vi.fn(async (args: UpsertArgs) => ({
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

describe("DEFAULT_VOUCHER_TYPES constant (REQ-D.1)", () => {
  it("D.1-S1a — exports exactly 8 entries", () => {
    expect(DEFAULT_VOUCHER_TYPES).toHaveLength(8);
  });

  it("D.1-S1b — includes all 8 standard codes in the Bolivian catalog", () => {
    const codes = DEFAULT_VOUCHER_TYPES.map((t) => t.code).sort();
    expect(codes).toEqual([...EXPECTED_CODES].sort());
  });

  it("D.1-S3 — every entry has the expected single-character prefix", () => {
    for (const t of DEFAULT_VOUCHER_TYPES) {
      expect(t.prefix).toBe(EXPECTED_PREFIXES[t.code]);
      expect(t.prefix).toHaveLength(1);
    }
  });

  it("D.1-S3b — every entry has a non-empty name", () => {
    for (const t of DEFAULT_VOUCHER_TYPES) {
      expect(t.name.length).toBeGreaterThan(0);
    }
  });
});

describe("seedVoucherTypes (REQ-D.1)", () => {
  it("D.1-S1 — fresh org: upsert invoked once per standard code", async () => {
    const mock = makeMockPrisma();

    await seedVoucherTypes("org-test", mock.client as never);

    expect(mock.upsert).toHaveBeenCalledTimes(8);
    const codesCalled = mock.upsert.mock.calls.map(
      (c) => (c[0] as { create: { code: string } }).create.code,
    );
    expect(codesCalled.sort()).toEqual([...EXPECTED_CODES].sort());
  });

  it("D.1-S1c — every upsert payload carries code + name + prefix + organizationId", async () => {
    const mock = makeMockPrisma();

    await seedVoucherTypes("org-test", mock.client as never);

    for (const call of mock.upsert.mock.calls) {
      const arg = call[0] as {
        create: {
          code: string;
          name: string;
          prefix: string;
          organizationId: string;
        };
      };
      expect(arg.create.organizationId).toBe("org-test");
      expect(arg.create.code).toMatch(/^C[IEDTANMB]$/);
      expect(arg.create.prefix).toBe(EXPECTED_PREFIXES[arg.create.code]);
      expect(arg.create.name.length).toBeGreaterThan(0);
    }
  });

  it("D.1-S2 — re-running on the same org uses upsert (idempotent by construction)", async () => {
    const mock = makeMockPrisma();

    await seedVoucherTypes("org-test", mock.client as never);
    await seedVoucherTypes("org-test", mock.client as never);

    // 2 runs × 8 types = 16 upsert calls; upsert semantics guarantee no duplicate rows
    expect(mock.upsert).toHaveBeenCalledTimes(16);
    for (const call of mock.upsert.mock.calls) {
      const arg = call[0] as { where: { organizationId_code: { code: string } } };
      // where clause must be the unique pair — proves idempotency path
      expect(arg.where.organizationId_code.code).toBeDefined();
    }
  });
});

describe("seed source file hygiene (REQ-D.1-S4)", () => {
  it("D.1-S4 — voucher-types.ts does NOT import VoucherTypeCode", () => {
    const src = readFileSync(
      path.resolve(__dirname, "../voucher-types.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/\bVoucherTypeCode\b/);
  });
});
