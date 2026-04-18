/**
 * T4.2 RED → T4.5..T4.6 GREEN
 * REQ-A.3 — UpdateVoucherType: name/prefix editable, code IMMUTABLE.
 *
 * A.3-S1 edit name → succeeds
 * A.3-S2 edit prefix → succeeds
 * A.3-S3 attempt to change code → VOUCHER_TYPE_CODE_IMMUTABLE
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { VoucherTypesService } from "@/features/voucher-types/voucher-types.service";
import { VoucherTypesRepository } from "@/features/voucher-types/voucher-types.repository";
import { updateVoucherTypeSchema } from "@/features/voucher-types/voucher-types.validation";

const ORG_ID = "org-edit";
const TYPE_ID = "vt-1";

const EXISTING = {
  id: TYPE_ID,
  code: "CT",
  name: "Traspaso",
  prefix: "T",
  description: null,
  organizationId: ORG_ID,
  isActive: true,
};

function makeRepo() {
  return {
    findById: vi.fn().mockResolvedValue(EXISTING),
    update: vi.fn(),
  } as unknown as VoucherTypesRepository & {
    findById: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
}

describe("updateVoucherTypeSchema (REQ-A.3 validation)", () => {
  it("A.3-S3a — schema is strict: unknown key `code` → ZodError", () => {
    const result = updateVoucherTypeSchema.safeParse({ code: "CX" });
    expect(result.success).toBe(false);
  });

  it("A.3-S3b — schema is strict: unknown key `organizationId` → ZodError", () => {
    const result = updateVoucherTypeSchema.safeParse({
      name: "ok",
      organizationId: "hacker",
    });
    expect(result.success).toBe(false);
  });

  it("A.3-S1 — editing name only → passes", () => {
    const result = updateVoucherTypeSchema.safeParse({ name: "Nuevo nombre" });
    expect(result.success).toBe(true);
  });

  it("A.3-S2 — editing prefix only → passes", () => {
    const result = updateVoucherTypeSchema.safeParse({ prefix: "X" });
    expect(result.success).toBe(true);
  });

  it("A.3 — prefix must be 1 char uppercase → ZodError on violation", () => {
    expect(updateVoucherTypeSchema.safeParse({ prefix: "XX" }).success).toBe(false);
    expect(updateVoucherTypeSchema.safeParse({ prefix: "x" }).success).toBe(false);
    expect(updateVoucherTypeSchema.safeParse({ prefix: "@" }).success).toBe(false);
  });

  it("A.3 — editing name + prefix + isActive → passes", () => {
    const result = updateVoucherTypeSchema.safeParse({
      name: "Nuevo",
      prefix: "X",
      isActive: false,
    });
    expect(result.success).toBe(true);
  });
});

describe("VoucherTypesService.update (REQ-A.3 business rules)", () => {
  let repo: ReturnType<typeof makeRepo>;
  let service: VoucherTypesService;

  beforeEach(() => {
    repo = makeRepo();
    service = new VoucherTypesService(repo as unknown as VoucherTypesRepository);
  });

  it("A.3-S1 — edit name succeeds", async () => {
    repo.update.mockResolvedValue({ ...EXISTING, name: "Traspaso Diario" });

    const result = await service.update(ORG_ID, TYPE_ID, {
      name: "Traspaso Diario",
    });

    expect(result.name).toBe("Traspaso Diario");
    expect(repo.update).toHaveBeenCalledWith(ORG_ID, TYPE_ID, {
      name: "Traspaso Diario",
    });
  });

  it("A.3-S2 — edit prefix succeeds", async () => {
    repo.update.mockResolvedValue({ ...EXISTING, prefix: "X" });

    const result = await service.update(ORG_ID, TYPE_ID, { prefix: "X" });

    expect(result.prefix).toBe("X");
    expect(repo.update).toHaveBeenCalledWith(ORG_ID, TYPE_ID, { prefix: "X" });
  });
});
