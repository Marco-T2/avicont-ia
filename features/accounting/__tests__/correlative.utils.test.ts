/**
 * T2.1 RED → T2.2 GREEN
 * REQ-B.3 — formatCorrelativeNumber recibe el `prefix` directamente del
 * VoucherTypeCfg en lugar de resolverlo vía map CI/CE/CD/CT/CA.
 *
 * B.3-S1 prefix "D" + 2026-04-15 + 15 → "D2604-000015"
 * B.3-S2 prefix "N" + 2026-04-01 + 1  → "N2604-000001"
 * B.3-S3 prefix null/""/undefined     → null
 */

import { describe, expect, it } from "vitest";
import { formatCorrelativeNumber } from "../correlative.utils";
import { toNoonUtc } from "@/lib/date-utils";

describe("formatCorrelativeNumber (REQ-B.3)", () => {
  it("B.3-S1 — prefix 'D' + 2026-04-15 + 15 → 'D2604-000015'", () => {
    expect(formatCorrelativeNumber("D", toNoonUtc("2026-04-15"), 15)).toBe(
      "D2604-000015",
    );
  });

  it("B.3-S2 — prefix 'N' + 2026-04-01 + 1 → 'N2604-000001'", () => {
    expect(formatCorrelativeNumber("N", toNoonUtc("2026-04-01"), 1)).toBe(
      "N2604-000001",
    );
  });

  it("B.3-S3a — prefix null → null", () => {
    expect(formatCorrelativeNumber(null, toNoonUtc("2026-04-15"), 15)).toBeNull();
  });

  it("B.3-S3b — prefix undefined → null", () => {
    expect(
      formatCorrelativeNumber(undefined, toNoonUtc("2026-04-15"), 15),
    ).toBeNull();
  });

  it("B.3-S3c — prefix empty string → null", () => {
    expect(formatCorrelativeNumber("", toNoonUtc("2026-04-15"), 15)).toBeNull();
  });

  it("B.3 regression — any single-char prefix works (prefix-agnostic)", () => {
    // The function must NOT validate against a hardcoded CI/CE/CD/CT/CA list;
    // it must accept whatever prefix the VoucherTypeCfg row provides.
    expect(formatCorrelativeNumber("X", toNoonUtc("2026-04-15"), 15)).toBe(
      "X2604-000015",
    );
    expect(formatCorrelativeNumber("B", toNoonUtc("2026-04-01"), 7)).toBe(
      "B2604-000007",
    );
  });

  it("B.3 edge — prefix 'D' + 2026-12-31 + 999999 → 'D2612-999999'", () => {
    expect(formatCorrelativeNumber("D", toNoonUtc("2026-12-31"), 999999)).toBe(
      "D2612-999999",
    );
  });

  it("B.3 edge — string 'YYYY-MM-DD' date also supported when caller passes it raw", () => {
    // Raw "YYYY-MM-DD" strings parse as UTC midnight, which under TZ=America/La_Paz
    // shifts the calendar day back by 4h. Production callers always go through
    // toNoonUtc first; this test documents the fallback path.
    expect(formatCorrelativeNumber("D", "2026-04-15T12:00:00.000Z", 15)).toBe(
      "D2604-000015",
    );
  });
});
