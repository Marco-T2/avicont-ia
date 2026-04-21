/**
 * REQ-D.2 — Migration backfill para orgs existentes
 *
 * D.2-S1 org con 9 types legacy → script agrega CP/CL/CV sin mutar originales
 * D.2-S2 org nueva (0 types) → script seedea los 12
 * D.2-S3 script corrido 2x → idempotente (0 rows adicionales en la segunda pasada)
 */

import { describe, expect, it, vi } from "vitest";
import { backfillPatrimonyVoucherTypes } from "../backfill-patrimony-voucher-types";

type UpsertArgs = {
  where: { organizationId_code: { organizationId: string; code: string } };
  create: Record<string, unknown>;
  update: Record<string, unknown>;
};

function makeMockPrisma(organizations: Array<{ id: string }>) {
  const upsert = vi.fn(async (args: UpsertArgs) => ({
    id: `vt-${args.create.code}-${args.create.organizationId}`,
    ...args.create,
  }));
  const findMany = vi.fn(async () => organizations);
  return {
    upsert,
    findMany,
    client: {
      organization: { findMany },
      voucherTypeCfg: { upsert },
      $disconnect: vi.fn(async () => undefined),
    },
  };
}

describe("backfillPatrimonyVoucherTypes (REQ-D.2)", () => {
  it("D.2-S2 — org sin types recibe los 12 codes", async () => {
    const mock = makeMockPrisma([{ id: "org-fresh" }]);

    const result = await backfillPatrimonyVoucherTypes(mock.client as never);

    expect(mock.findMany).toHaveBeenCalledTimes(1);
    expect(mock.upsert).toHaveBeenCalledTimes(12);
    const codes = mock.upsert.mock.calls
      .map((c) => (c[0] as { create: { code: string } }).create.code)
      .sort();
    expect(codes).toEqual(
      ["CA", "CB", "CD", "CE", "CI", "CJ", "CL", "CM", "CN", "CP", "CT", "CV"].sort(),
    );
    expect(result.orgsProcessed).toBe(1);
  });

  it("D.2-S1 — con 2 orgs, ejecuta 12 upserts por org (24 total) usando update:{}", async () => {
    const mock = makeMockPrisma([{ id: "org-a" }, { id: "org-b" }]);

    const result = await backfillPatrimonyVoucherTypes(mock.client as never);

    expect(mock.upsert).toHaveBeenCalledTimes(24);
    const perOrg: Record<string, number> = {};
    for (const call of mock.upsert.mock.calls) {
      const arg = call[0] as { create: { organizationId: string }; update: Record<string, unknown> };
      perOrg[arg.create.organizationId] = (perOrg[arg.create.organizationId] ?? 0) + 1;
      // update:{} proves backfill NEVER mutates existing rows — REQ-D.2 "8 originales intactos"
      expect(arg.update).toEqual({});
    }
    expect(perOrg["org-a"]).toBe(12);
    expect(perOrg["org-b"]).toBe(12);
    expect(result.orgsProcessed).toBe(2);
  });

  it("D.2-S3 — segunda corrida es idempotente (upsert.update={} no-op)", async () => {
    const mock = makeMockPrisma([{ id: "org-a" }]);

    await backfillPatrimonyVoucherTypes(mock.client as never);
    const firstRunUpserts = mock.upsert.mock.calls.length;

    await backfillPatrimonyVoucherTypes(mock.client as never);
    const totalUpserts = mock.upsert.mock.calls.length;

    // Second run invokes the same 12 upserts; DB-side effect is 0 net rows
    expect(totalUpserts - firstRunUpserts).toBe(12);
    for (const call of mock.upsert.mock.calls) {
      const arg = call[0] as { update: Record<string, unknown> };
      expect(arg.update).toEqual({});
    }
  });

  it("D.2-S4 — 0 orgs activas → 0 upserts, resultado válido", async () => {
    const mock = makeMockPrisma([]);

    const result = await backfillPatrimonyVoucherTypes(mock.client as never);

    expect(mock.upsert).toHaveBeenCalledTimes(0);
    expect(result.orgsProcessed).toBe(0);
  });
});
