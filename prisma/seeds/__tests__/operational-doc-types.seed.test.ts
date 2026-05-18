/**
 * REQ — Seed OperationalDocType catalog per organization (journal-physical-document Phase 2)
 *
 * Spec capability 2: 10 canonical codes (VG, ND, BC, FL, PF, CG, SV, RC, RI, RE)
 * MUST be seeded per org via `findFirst + skip` (NOT upsert) so that existing
 * rows with the same (orgId, code) are NEVER mutated. Direction values use the
 * extended OperationalDocDirection (Phase 1) — VENTA, DESPACHO, COMPRA, COBRO, PAGO.
 *
 * Invariants honored:
 * - I-4: seed MUST NOT overwrite existing rows with same (orgId, code).
 * - Idempotent on re-run: zero duplicates created.
 */

import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_OPERATIONAL_DOC_TYPES,
  seedOperationalDocTypes,
} from "../operational-doc-types";

const EXPECTED_CODES = [
  "VG", "ND", "BC", "FL", "PF", "CG", "SV", "RC", "RI", "RE",
] as const;

const EXPECTED_DIRECTIONS: Record<string, string> = {
  VG: "VENTA",
  ND: "DESPACHO",
  BC: "DESPACHO",
  FL: "COMPRA",
  PF: "COMPRA",
  CG: "COMPRA",
  SV: "COMPRA",
  RC: "COBRO",
  RI: "COBRO",
  RE: "PAGO",
};

type FindFirstArgs = {
  where: { organizationId: string; code: string };
};

type CreateArgs = {
  data: {
    organizationId: string;
    code: string;
    name: string;
    direction: string;
    isActive: boolean;
  };
};

function makeMockPrisma(existingByCode: Record<string, boolean> = {}) {
  const findFirst = vi.fn(async (args: FindFirstArgs) =>
    existingByCode[args.where.code]
      ? { id: `existing-${args.where.code}` }
      : null,
  );
  const create = vi.fn(async (args: CreateArgs) => ({
    id: `id-${args.data.code}`,
    ...args.data,
  }));
  return {
    findFirst,
    create,
    client: {
      operationalDocType: { findFirst, create },
      $disconnect: vi.fn(async () => undefined),
    },
  };
}

describe("DEFAULT_OPERATIONAL_DOC_TYPES constant", () => {
  it("exports exactly 10 canonical codes", () => {
    expect(DEFAULT_OPERATIONAL_DOC_TYPES).toHaveLength(10);
  });

  it("lists every expected code", () => {
    const codes = DEFAULT_OPERATIONAL_DOC_TYPES.map((d) => d.code).sort();
    expect(codes).toEqual([...EXPECTED_CODES].sort());
  });

  it("maps every code to the spec-locked direction", () => {
    for (const entry of DEFAULT_OPERATIONAL_DOC_TYPES) {
      expect(entry.direction).toBe(EXPECTED_DIRECTIONS[entry.code]);
    }
  });

  it("every entry carries a non-empty name", () => {
    for (const entry of DEFAULT_OPERATIONAL_DOC_TYPES) {
      expect(entry.name.length).toBeGreaterThan(0);
    }
  });
});

describe("seedOperationalDocTypes — fresh org", () => {
  it("creates all 10 rows on first run when none exist", async () => {
    const mock = makeMockPrisma();

    await seedOperationalDocTypes("org-fresh", mock.client as never);

    expect(mock.findFirst).toHaveBeenCalledTimes(10);
    expect(mock.create).toHaveBeenCalledTimes(10);
    const codesCreated = mock.create.mock.calls.map(
      (c) => (c[0] as CreateArgs).data.code,
    );
    expect(codesCreated.sort()).toEqual([...EXPECTED_CODES].sort());
  });

  it("every create payload sets isActive=true and the correct direction", async () => {
    const mock = makeMockPrisma();

    await seedOperationalDocTypes("org-fresh", mock.client as never);

    for (const call of mock.create.mock.calls) {
      const arg = call[0] as CreateArgs;
      expect(arg.data.organizationId).toBe("org-fresh");
      expect(arg.data.isActive).toBe(true);
      expect(arg.data.direction).toBe(EXPECTED_DIRECTIONS[arg.data.code]);
    }
  });
});

describe("seedOperationalDocTypes — idempotency (I-4)", () => {
  it("skips create when a row with the same code already exists", async () => {
    const mock = makeMockPrisma({ RC: true, RE: true });

    await seedOperationalDocTypes("org-with-rcre", mock.client as never);

    expect(mock.findFirst).toHaveBeenCalledTimes(10);
    expect(mock.create).toHaveBeenCalledTimes(8);
    const codesCreated = mock.create.mock.calls.map(
      (c) => (c[0] as CreateArgs).data.code,
    );
    expect(codesCreated).not.toContain("RC");
    expect(codesCreated).not.toContain("RE");
  });

  it("second invocation on a fully-seeded org creates zero rows", async () => {
    // First run: nothing exists → 10 creates
    const firstRun = makeMockPrisma();
    await seedOperationalDocTypes("org-twice", firstRun.client as never);
    expect(firstRun.create).toHaveBeenCalledTimes(10);

    // Second run: everything exists → zero creates
    const allExist = Object.fromEntries(
      EXPECTED_CODES.map((c) => [c, true]),
    );
    const secondRun = makeMockPrisma(allExist);
    await seedOperationalDocTypes("org-twice", secondRun.client as never);

    expect(secondRun.findFirst).toHaveBeenCalledTimes(10);
    expect(secondRun.create).toHaveBeenCalledTimes(0);
  });
});
