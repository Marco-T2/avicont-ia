/**
 * REQ-D.1 — Seed creates standard voucher types per org, idempotent, prefix-backed
 *
 * D.1-S1 fresh org → 12 rows (CJ for adjustments + CP/CL/CV for patrimony)
 * D.1-S2 idempotent — re-run → no duplicates (upsert semantics)
 * D.1-S3 every seed entry has a non-empty prefix
 * D.1-S4 seed file text does NOT import VoucherTypeCode enum
 * D.1-S5 CJ carries isAdjustment=true; CP/CL/CV are patrimony codes (isAdjustment=false)
 * D.1-S6 re-seed on org with existing 9 types adds CP/CL/CV without mutating previous rows
 */

import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  DEFAULT_VOUCHER_TYPES,
  seedVoucherTypes,
} from "../voucher-types";

// ── Fixtures ──

const EXPECTED_CODES = [
  "CI", "CE", "CD", "CJ", "CT", "CA", "CN", "CM", "CB",
  "CP", "CL", "CV",
] as const;
const EXPECTED_PREFIXES: Record<string, string> = {
  CI: "I",
  CE: "E",
  CD: "D",
  CJ: "J",
  CT: "T",
  CA: "A",
  CN: "N",
  CM: "M",
  CB: "B",
  CP: "P",
  CL: "L",
  CV: "V",
};
const PATRIMONY_CODES = ["CP", "CL", "CV"] as const;

// Minimal Prisma-shape mock — we only exercise voucherTypeCfg.upsert + $disconnect
type UpsertArgs = {
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
  it("D.1-S1a — exports exactly 12 entries (9 legacy + 3 patrimony)", () => {
    expect(DEFAULT_VOUCHER_TYPES).toHaveLength(12);
  });

  it("D.1-S1b — includes all standard codes in the Bolivian catalog", () => {
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

  it("D.1-S5 — CJ is the only entry flagged as isAdjustment=true", () => {
    const adjustments = DEFAULT_VOUCHER_TYPES.filter((t) => t.isAdjustment);
    expect(adjustments).toHaveLength(1);
    expect(adjustments[0].code).toBe("CJ");
  });

  it("D.1-S5b — every non-CJ entry has isAdjustment=false", () => {
    for (const t of DEFAULT_VOUCHER_TYPES) {
      if (t.code !== "CJ") expect(t.isAdjustment).toBe(false);
    }
  });

  it("D.1-S5c — patrimony codes CP, CL, CV are present with expected prefixes", () => {
    const byCode = new Map(DEFAULT_VOUCHER_TYPES.map((t) => [t.code, t]));
    for (const code of PATRIMONY_CODES) {
      const entry = byCode.get(code);
      expect(entry, `${code} must be seeded`).toBeDefined();
      expect(entry!.prefix).toBe(EXPECTED_PREFIXES[code]);
      expect(entry!.isAdjustment).toBe(false);
      expect(entry!.name.length).toBeGreaterThan(0);
    }
  });

  it("D.1-S5d — each patrimony entry has a descriptive name referencing its semantics", () => {
    const byCode = new Map(DEFAULT_VOUCHER_TYPES.map((t) => [t.code, t]));
    expect(byCode.get("CP")!.name).toMatch(/Aporte de Capital/i);
    expect(byCode.get("CL")!.name).toMatch(/Reserva/i);
    expect(byCode.get("CV")!.name).toMatch(/Distribuci/i);
  });
});

describe("seedVoucherTypes (REQ-D.1)", () => {
  it("D.1-S1 — fresh org: upsert invoked once per standard code (12 total)", async () => {
    const mock = makeMockPrisma();

    await seedVoucherTypes("org-test", mock.client as never);

    expect(mock.upsert).toHaveBeenCalledTimes(12);
    const codesCalled = mock.upsert.mock.calls.map(
      (c) => (c[0] as { create: { code: string } }).create.code,
    );
    expect(codesCalled.sort()).toEqual([...EXPECTED_CODES].sort());
  });

  it("D.1-S1c — every upsert payload carries code + name + prefix + organizationId + isAdjustment", async () => {
    const mock = makeMockPrisma();

    await seedVoucherTypes("org-test", mock.client as never);

    for (const call of mock.upsert.mock.calls) {
      const arg = call[0] as {
        create: {
          code: string;
          name: string;
          prefix: string;
          organizationId: string;
          isAdjustment: boolean;
        };
      };
      expect(arg.create.organizationId).toBe("org-test");
      expect(arg.create.code).toMatch(/^C[IEDJTANMBPLV]$/);
      expect(arg.create.prefix).toBe(EXPECTED_PREFIXES[arg.create.code]);
      expect(arg.create.name.length).toBeGreaterThan(0);
      expect(typeof arg.create.isAdjustment).toBe("boolean");
      if (arg.create.code === "CJ") {
        expect(arg.create.isAdjustment).toBe(true);
      } else {
        expect(arg.create.isAdjustment).toBe(false);
      }
    }
  });

  it("D.1-S2 — re-running on the same org uses upsert (idempotent by construction)", async () => {
    const mock = makeMockPrisma();

    await seedVoucherTypes("org-test", mock.client as never);
    await seedVoucherTypes("org-test", mock.client as never);

    // 2 runs × 12 types = 24 upsert calls; upsert semantics guarantee no duplicate rows
    expect(mock.upsert).toHaveBeenCalledTimes(24);
    for (const call of mock.upsert.mock.calls) {
      const arg = call[0] as { where: { organizationId_code: { code: string } } };
      // where clause must be the unique pair — proves idempotency path
      expect(arg.where.organizationId_code.code).toBeDefined();
    }
  });

  it("D.1-S6 — re-seed on org with 9 legacy types upserts ALL codes (non-patrimony updates no-op)", async () => {
    // Simulates "backfill" — the 9 legacy types are already present in a real DB,
    // and upsert.update={} is a no-op for them. The 3 patrimony codes get created.
    const mock = makeMockPrisma();

    await seedVoucherTypes("org-legacy", mock.client as never);

    const codes = mock.upsert.mock.calls.map(
      (c) => (c[0] as { create: { code: string } }).create.code,
    );
    for (const code of PATRIMONY_CODES) {
      expect(codes).toContain(code);
    }
    // Every upsert call uses update:{} — empty update guarantees no mutation of
    // existing rows on re-run, satisfying REQ-D.2 "8 originales intactos".
    for (const call of mock.upsert.mock.calls) {
      const arg = call[0] as { update: Record<string, unknown> };
      expect(arg.update).toEqual({});
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
