/**
 * T4.3 RED → T4.6..T4.7 GREEN
 * REQ-A.4 — Soft-deactivate semantics + list({ isActive? }) filter.
 *
 * A.4-S1 deactivating preserves history — no JE rows touched, only VT.isActive
 * A.4-S2 list({ isActive: true }) excludes deactivated type
 * A.4-S3 list() (no filter) returns both active and inactive
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { VoucherTypesService } from "@/features/voucher-types/voucher-types.service";
import { VoucherTypesRepository } from "@/features/voucher-types/voucher-types.repository";

const ORG_ID = "org-deactivate";
const ACTIVE_VT = {
  id: "vt-active",
  code: "CA",
  name: "Activo",
  prefix: "A",
  description: null,
  organizationId: ORG_ID,
  isActive: true,
};
const INACTIVE_VT = {
  id: "vt-inactive",
  code: "CX",
  name: "Inactivo",
  prefix: "X",
  description: null,
  organizationId: ORG_ID,
  isActive: false,
};

function makeRepo() {
  return {
    findById: vi.fn(),
    findAll: vi.fn(),
    update: vi.fn(),
  } as unknown as VoucherTypesRepository & {
    findById: ReturnType<typeof vi.fn>;
    findAll: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
}

describe("VoucherTypesService — deactivation (REQ-A.4)", () => {
  let repo: ReturnType<typeof makeRepo>;
  let service: VoucherTypesService;

  beforeEach(() => {
    repo = makeRepo();
    service = new VoucherTypesService(repo as unknown as VoucherTypesRepository);
  });

  it("A.4-S1 — deactivation updates only VoucherTypeCfg; no JE path invoked", async () => {
    repo.findById.mockResolvedValue(ACTIVE_VT);
    repo.update.mockResolvedValue({ ...ACTIVE_VT, isActive: false });

    const result = await service.update(ORG_ID, ACTIVE_VT.id, {
      isActive: false,
    });

    expect(result.isActive).toBe(false);
    // Service never touches JE tables during deactivation — assertion is structural:
    // repo.update was called with isActive only, not with any JE-side effect.
    expect(repo.update).toHaveBeenCalledWith(ORG_ID, ACTIVE_VT.id, {
      isActive: false,
    });
  });

  it("A.4-S2 — list({ isActive: true }) passes the filter down to the repo", async () => {
    repo.findAll.mockResolvedValue([ACTIVE_VT]);

    const result = await service.list(ORG_ID, { isActive: true });

    expect(result).toEqual([ACTIVE_VT]);
    expect(repo.findAll).toHaveBeenCalledWith(ORG_ID, { isActive: true });
  });

  it("A.4-S3a — list() (no options) returns active AND inactive", async () => {
    repo.findAll.mockResolvedValue([ACTIVE_VT, INACTIVE_VT]);

    const result = await service.list(ORG_ID);

    expect(result).toEqual([ACTIVE_VT, INACTIVE_VT]);
    // No isActive filter propagated
    const call = repo.findAll.mock.calls[0];
    expect(call[0]).toBe(ORG_ID);
    const opts = call[1] as { isActive?: boolean } | undefined;
    expect(opts?.isActive).toBeUndefined();
  });

  it("A.4-S3b — list({ includeCounts: true }) passes the flag down", async () => {
    repo.findAll.mockResolvedValue([ACTIVE_VT]);

    await service.list(ORG_ID, { includeCounts: true });

    expect(repo.findAll).toHaveBeenCalledWith(ORG_ID, { includeCounts: true });
  });
});
