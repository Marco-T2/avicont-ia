/**
 * T4.1 RED → T4.4..T4.7 GREEN
 * REQ-A.2 — CreateVoucherType validation + duplicate guard.
 *
 * A.2-S1 missing required field → validation error 422
 * A.2-S2 duplicate code within same org → 409 VOUCHER_TYPE_CODE_DUPLICATE
 * A.2-S3 duplicate code across different orgs → succeeds (per-org uniqueness)
 * A.2-S4 valid input → 201-shape payload returned
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { VoucherTypesService } from "@/features/voucher-types/voucher-types.service";
import { VoucherTypesRepository } from "@/features/voucher-types/voucher-types.repository";
import { createVoucherTypeSchema } from "@/features/voucher-types/voucher-types.validation";
import { VOUCHER_TYPE_CODE_DUPLICATE } from "@/features/shared/errors";

const ORG_A = "org-A";
const ORG_B = "org-B";

function makeRepo() {
  return {
    findByCode: vi.fn(),
    create: vi.fn(),
  } as unknown as VoucherTypesRepository & {
    findByCode: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
}

describe("createVoucherTypeSchema (REQ-A.2 validation)", () => {
  it("A.2-S1a — missing code → ZodError", () => {
    const result = createVoucherTypeSchema.safeParse({
      name: "Test",
      prefix: "T",
    });
    expect(result.success).toBe(false);
  });

  it("A.2-S1b — missing name → ZodError", () => {
    const result = createVoucherTypeSchema.safeParse({
      code: "CT",
      prefix: "T",
    });
    expect(result.success).toBe(false);
  });

  it("A.2-S1c — missing prefix → ZodError", () => {
    const result = createVoucherTypeSchema.safeParse({
      code: "CT",
      name: "Test",
    });
    expect(result.success).toBe(false);
  });

  it("A.2-S1d — code too short (1 char) → ZodError", () => {
    const result = createVoucherTypeSchema.safeParse({
      code: "C",
      name: "Test",
      prefix: "T",
    });
    expect(result.success).toBe(false);
  });

  it("A.2-S1e — prefix > 1 char → ZodError", () => {
    const result = createVoucherTypeSchema.safeParse({
      code: "CT",
      name: "Test",
      prefix: "TX",
    });
    expect(result.success).toBe(false);
  });

  it("A.2-S1f — lowercase code → ZodError (must be uppercase A-Z0-9)", () => {
    const result = createVoucherTypeSchema.safeParse({
      code: "ct",
      name: "Test",
      prefix: "T",
    });
    expect(result.success).toBe(false);
  });

  it("A.2-S4a — valid input passes", () => {
    const result = createVoucherTypeSchema.safeParse({
      code: "CX",
      name: "Custom",
      prefix: "X",
    });
    expect(result.success).toBe(true);
  });

  it("A.2-S4b — valid input with optional description", () => {
    const result = createVoucherTypeSchema.safeParse({
      code: "CX",
      name: "Custom",
      prefix: "X",
      description: "Comprobante custom",
    });
    expect(result.success).toBe(true);
  });
});

describe("VoucherTypesService.create (REQ-A.2 business rules)", () => {
  let repo: ReturnType<typeof makeRepo>;
  let service: VoucherTypesService;

  beforeEach(() => {
    repo = makeRepo();
    service = new VoucherTypesService(repo as unknown as VoucherTypesRepository);
  });

  it("A.2-S2 — duplicate code in same org → throws VOUCHER_TYPE_CODE_DUPLICATE", async () => {
    repo.findByCode.mockResolvedValue({
      id: "existing",
      code: "CX",
      organizationId: ORG_A,
    });

    await expect(
      service.create(ORG_A, {
        code: "CX",
        name: "Custom",
        prefix: "X",
      }),
    ).rejects.toMatchObject({ code: VOUCHER_TYPE_CODE_DUPLICATE });

    expect(repo.create).not.toHaveBeenCalled();
  });

  it("A.2-S3 — duplicate code in different org → creation succeeds", async () => {
    repo.findByCode.mockResolvedValue(null); // none in ORG_B
    repo.create.mockResolvedValue({
      id: "new-id",
      code: "CX",
      name: "Custom",
      prefix: "X",
      organizationId: ORG_B,
    });

    const result = await service.create(ORG_B, {
      code: "CX",
      name: "Custom",
      prefix: "X",
    });

    expect(result.id).toBe("new-id");
    expect(repo.findByCode).toHaveBeenCalledWith(ORG_B, "CX");
    expect(repo.create).toHaveBeenCalledOnce();
  });

  it("A.2-S4 — valid creation → repo.create called with scoped payload", async () => {
    repo.findByCode.mockResolvedValue(null);
    const created = {
      id: "vt-new",
      code: "CX",
      name: "Custom",
      prefix: "X",
      description: null,
      organizationId: ORG_A,
      isActive: true,
    };
    repo.create.mockResolvedValue(created);

    const result = await service.create(ORG_A, {
      code: "CX",
      name: "Custom",
      prefix: "X",
    });

    expect(result).toEqual(created);
    const callArgs = repo.create.mock.calls[0];
    expect(callArgs[0]).toBe(ORG_A);
    expect(callArgs[1]).toMatchObject({
      code: "CX",
      name: "Custom",
      prefix: "X",
    });
  });
});
