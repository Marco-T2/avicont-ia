/**
 * REQ-D.2 — Migration backfill para orgs existentes
 *
 * D.2-S1 org con 9 types legacy → script agrega CP/CL/CV/CC sin mutar originales
 * D.2-S2 org nueva (0 types) → script seedea los 13
 * D.2-S3 script corrido 2x → idempotente (0 rows adicionales en la segunda pasada)
 *
 * Phase 2 housekeeping (annual-close) — counts widened from 12 → 13 to track
 * the CC voucher (Comprobante de Cierre) added in commit c3fc6679 (REQ-3.1).
 * Sister fix to `voucher-types.seed.test.ts` per [[mock_hygiene_commit_scope]];
 * deferred from Phase 1.6 GREEN.
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
  it("D.2-S2 — org sin types recibe los 13 codes", async () => {
    const mock = makeMockPrisma([{ id: "org-fresh" }]);

    const result = await backfillPatrimonyVoucherTypes(mock.client as never);

    expect(mock.findMany).toHaveBeenCalledTimes(1);
    expect(mock.upsert).toHaveBeenCalledTimes(13);
    const codes = mock.upsert.mock.calls
      .map((c) => (c[0] as unknown as { create: { code: string } }).create.code)
      .sort();
    expect(codes).toEqual(
      ["CA", "CB", "CC", "CD", "CE", "CI", "CJ", "CL", "CM", "CN", "CP", "CT", "CV"].sort(),
    );
    expect(result.orgsProcessed).toBe(1);
  });

  it("D.2-S1 — con 2 orgs, ejecuta 13 upserts por org (26 total) usando update:{}", async () => {
    const mock = makeMockPrisma([{ id: "org-a" }, { id: "org-b" }]);

    const result = await backfillPatrimonyVoucherTypes(mock.client as never);

    expect(mock.upsert).toHaveBeenCalledTimes(26);
    const perOrg: Record<string, number> = {};
    for (const call of mock.upsert.mock.calls) {
      const arg = call[0] as unknown as { create: { organizationId: string }; update: Record<string, unknown> };
      perOrg[arg.create.organizationId] = (perOrg[arg.create.organizationId] ?? 0) + 1;
      // update:{} proves backfill NEVER mutates existing rows — REQ-D.2 "8 originales intactos"
      expect(arg.update).toEqual({});
    }
    expect(perOrg["org-a"]).toBe(13);
    expect(perOrg["org-b"]).toBe(13);
    expect(result.orgsProcessed).toBe(2);
  });

  it("D.2-S3 — segunda corrida es idempotente (upsert.update={} no-op)", async () => {
    const mock = makeMockPrisma([{ id: "org-a" }]);

    await backfillPatrimonyVoucherTypes(mock.client as never);
    const firstRunUpserts = mock.upsert.mock.calls.length;

    await backfillPatrimonyVoucherTypes(mock.client as never);
    const totalUpserts = mock.upsert.mock.calls.length;

    // Second run invokes the same 13 upserts; DB-side effect is 0 net rows
    expect(totalUpserts - firstRunUpserts).toBe(13);
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
