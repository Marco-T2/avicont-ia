import { describe, expect, it } from "vitest";
import { ForbiddenError, ValidationError } from "@/features/shared/errors";
import {
  SaleAccountNotFound,
  SaleContactChangeWithAllocations,
  SaleContactNotClient,
  SaleLockedEditMissingJustification,
  SalePeriodClosed,
  SalePostNotAllowedForRole,
} from "../../errors/sale-orchestration-errors";

describe("SaleContactNotClient", () => {
  it("extends ValidationError with SALE_INVALID_CONTACT_TYPE code and contact context", () => {
    const err = new SaleContactNotClient("PROVEEDOR");

    expect(err).toBeInstanceOf(ValidationError);
    expect(err.code).toBe("SALE_INVALID_CONTACT_TYPE");
    expect(err.name).toBe("SaleContactNotClient");
    expect(err.message).toContain("CLIENTE");
    expect(err.details).toEqual({ contactType: "PROVEEDOR" });
  });
});

describe("SaleAccountNotFound", () => {
  it("extends ValidationError with SALE_INCOME_ACCOUNT_REQUIRED code and accountId context", () => {
    const err = new SaleAccountNotFound("acc-123");

    expect(err).toBeInstanceOf(ValidationError);
    expect(err.code).toBe("SALE_INCOME_ACCOUNT_REQUIRED");
    expect(err.name).toBe("SaleAccountNotFound");
    expect(err.message).toContain("acc-123");
    expect(err.details).toEqual({ accountId: "acc-123" });
  });
});

describe("SaleContactChangeWithAllocations", () => {
  it("extends ValidationError with SALE_CONTACT_CHANGE_BLOCKED code", () => {
    const err = new SaleContactChangeWithAllocations();

    expect(err).toBeInstanceOf(ValidationError);
    expect(err.code).toBe("SALE_CONTACT_CHANGE_BLOCKED");
    expect(err.name).toBe("SaleContactChangeWithAllocations");
    expect(err.message).toContain("cobros");
  });
});

describe("SalePostNotAllowedForRole", () => {
  it("extends ForbiddenError with POST_NOT_ALLOWED_FOR_ROLE code and role context", () => {
    const err = new SalePostNotAllowedForRole("OPERADOR");

    expect(err).toBeInstanceOf(ForbiddenError);
    expect(err.code).toBe("POST_NOT_ALLOWED_FOR_ROLE");
    expect(err.name).toBe("SalePostNotAllowedForRole");
    expect(err.message).toContain("ventas");
    expect(err.details).toEqual({ role: "OPERADOR" });
  });
});

describe("SalePeriodClosed", () => {
  it("extends ValidationError with FISCAL_PERIOD_CLOSED code and periodId context", () => {
    const err = new SalePeriodClosed("period-2025-01");

    expect(err).toBeInstanceOf(ValidationError);
    expect(err.code).toBe("FISCAL_PERIOD_CLOSED");
    expect(err.name).toBe("SalePeriodClosed");
    expect(err.message).toContain("período");
    expect(err.details).toEqual({ periodId: "period-2025-01" });
  });
});

describe("SaleLockedEditMissingJustification", () => {
  it("extends ValidationError with LOCKED_EDIT_REQUIRES_JUSTIFICATION code", () => {
    const err = new SaleLockedEditMissingJustification();

    expect(err).toBeInstanceOf(ValidationError);
    expect(err.code).toBe("LOCKED_EDIT_REQUIRES_JUSTIFICATION");
    expect(err.name).toBe("SaleLockedEditMissingJustification");
    expect(err.message).toContain("justificación");
  });
});
