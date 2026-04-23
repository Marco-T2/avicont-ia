/**
 * T2 — Unit tests for chart-of-accounts seed.
 *
 * Covers: REQ-CA.4 (seed includes Amortización Acumulada + marks contra accounts)
 *
 * Uses a mock PrismaClient — does not touch the real DB.
 */

import { describe, it, expect } from "vitest";

// ── Inspect the exported accounts array (static analysis) ──
// We import the ACCOUNTS constant directly — no DB call needed.
import { ACCOUNTS } from "../chart-of-accounts";

describe("chart-of-accounts seed (REQ-CA.4)", () => {
  it("CA.4-S1a — 1.2.6 Depreciación Acumulada has isContraAccount=true", () => {
    const deprec = ACCOUNTS.find((a) => a.code === "1.2.6");
    expect(deprec).toBeDefined();
    expect(deprec!.name).toMatch(/depreciaci.*acumulada/i);
    expect(deprec!.isContraAccount).toBe(true);
  });

  it("CA.4-S1b — 1.2.8 Amortización Acumulada exists with isContraAccount=true", () => {
    const amor = ACCOUNTS.find((a) => a.code === "1.2.8");
    expect(amor).toBeDefined();
    expect(amor!.name).toMatch(/amortizaci.*acumulada/i);
    expect(amor!.isContraAccount).toBe(true);
    expect(amor!.type).toBe("ACTIVO");
    expect(amor!.subtype).toBe("ACTIVO_NO_CORRIENTE");
    expect(amor!.parentCode).toBe("1.2");
    expect(amor!.level).toBe(3);
    expect(amor!.isDetail).toBe(true);
  });

  it("CA.4-S2 — 1.2.7 Activos Biológicos unchanged with isContraAccount=false (or undefined)", () => {
    const bio = ACCOUNTS.find((a) => a.code === "1.2.7");
    expect(bio).toBeDefined();
    expect(bio!.name).toBe("Activos Biológicos");
    expect(bio!.isContraAccount).toBeFalsy();
  });

  it("CA.4-S3 — no slot collision: only one account at code 1.2.8", () => {
    const accounts128 = ACCOUNTS.filter((a) => a.code === "1.2.8");
    expect(accounts128).toHaveLength(1);
  });

  it("CA.4-S4 — non-contra accounts do not have isContraAccount=true", () => {
    const normalAccounts = ACCOUNTS.filter(
      (a) => a.code !== "1.2.6" && a.code !== "1.2.8"
    );
    for (const acc of normalAccounts) {
      expect(acc.isContraAccount).toBeFalsy();
    }
  });
});
