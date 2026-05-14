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

describe("chart-of-accounts seed — 4-level hierarchy (account-picker)", () => {
  const DEMOTED_PARENTS = ["1.1.1", "1.1.2", "1.1.3", "1.1.4", "2.1.1"] as const;

  // code → { parent, requiresContact } expected for the 8 new level-4 leaves
  const LEVEL4_LEAVES: Record<
    string,
    { parentCode: string; requiresContact: boolean }
  > = {
    "1.1.1.1": { parentCode: "1.1.1", requiresContact: false },
    "1.1.1.2": { parentCode: "1.1.1", requiresContact: false },
    "1.1.2.1": { parentCode: "1.1.2", requiresContact: false },
    "1.1.3.1": { parentCode: "1.1.3", requiresContact: false },
    "1.1.3.2": { parentCode: "1.1.3", requiresContact: false },
    "1.1.3.3": { parentCode: "1.1.3", requiresContact: false },
    "1.1.4.1": { parentCode: "1.1.4", requiresContact: true },
    "2.1.1.1": { parentCode: "2.1.1", requiresContact: true },
  };

  it("L4-S1 — the 5 former level-3 leaves are demoted to isDetail:false", () => {
    for (const code of DEMOTED_PARENTS) {
      const acc = ACCOUNTS.find((a) => a.code === code);
      expect(acc, `account ${code} must exist`).toBeDefined();
      expect(acc!.isDetail, `account ${code} must be a parent node`).toBe(false);
      expect(acc!.level).toBe(3);
    }
  });

  it("L4-S2 — 8 level-4 leaves exist with level:4 and isDetail:true", () => {
    const leaves = ACCOUNTS.filter((a) => a.level === 4);
    expect(leaves).toHaveLength(8);
    for (const code of Object.keys(LEVEL4_LEAVES)) {
      const acc = ACCOUNTS.find((a) => a.code === code);
      expect(acc, `level-4 account ${code} must exist`).toBeDefined();
      expect(acc!.level).toBe(4);
      expect(acc!.isDetail).toBe(true);
    }
  });

  it("L4-S3 — each level-4 leaf points to the correct parentCode", () => {
    for (const [code, expected] of Object.entries(LEVEL4_LEAVES)) {
      const acc = ACCOUNTS.find((a) => a.code === code)!;
      expect(acc.parentCode).toBe(expected.parentCode);
    }
  });

  it("L4-S4 — level-4 leaves inherit subtype + requiresContact from their parent", () => {
    for (const [code, expected] of Object.entries(LEVEL4_LEAVES)) {
      const acc = ACCOUNTS.find((a) => a.code === code)!;
      const parent = ACCOUNTS.find((a) => a.code === expected.parentCode)!;
      expect(acc.subtype, `${code} subtype must match parent`).toBe(parent.subtype);
      expect(acc.requiresContact, `${code} requiresContact must match parent`).toBe(
        parent.requiresContact,
      );
      expect(acc.requiresContact).toBe(expected.requiresContact);
      expect(acc.type).toBe(parent.type);
    }
  });

  it("L4-S5 — no duplicate codes in the chart of accounts", () => {
    const codes = ACCOUNTS.map((a) => a.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});
