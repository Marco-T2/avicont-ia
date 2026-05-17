import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// REQ-16 — Port + Adapter scaffolding shape gate.
//
// Strategy: text-level assertions on the two NEW files (port + adapter). The
// 6 method signatures + DTO export shape are verified statically. Integration
// behavior per method lands in cycles 1-6 with mocked-service tests.
//
// Expected RED failure mode: ENOENT (`readFileSync` throws) — both files
// are absent until GREEN.

const ROOT = resolve(__dirname, "../../..");
const PORT_PATH = resolve(
  ROOT,
  "modules/ai-agent/domain/ports/accounting-query.port.ts",
);
const ADAPTER_PATH = resolve(
  ROOT,
  "modules/ai-agent/infrastructure/adapters/accounting-query.adapter.ts",
);

describe("C0 — AccountingQueryPort file shape (REQ-16)", () => {
  it("port file exists", () => {
    expect(existsSync(PORT_PATH)).toBe(true);
  });

  it("declares AccountingQueryPort interface", () => {
    const content = readFileSync(PORT_PATH, "utf-8");
    expect(content).toMatch(/export interface AccountingQueryPort\b/);
  });

  it("declares all 6 port methods", () => {
    const content = readFileSync(PORT_PATH, "utf-8");
    expect(content).toMatch(/listRecentJournalEntries\s*\(/);
    expect(content).toMatch(/getAccountMovements\s*\(/);
    expect(content).toMatch(/getAccountBalance\s*\(/);
    expect(content).toMatch(/listSales\s*\(/);
    expect(content).toMatch(/listPurchases\s*\(/);
    expect(content).toMatch(/listPayments\s*\(/);
  });

  it("exports all 6 DTO interfaces per design §2", () => {
    const content = readFileSync(PORT_PATH, "utf-8");
    expect(content).toMatch(/export interface JournalEntrySummaryDto\b/);
    expect(content).toMatch(/export interface LedgerEntryDto\b/);
    expect(content).toMatch(/export interface SaleSummaryDto\b/);
    expect(content).toMatch(/export interface PurchaseSummaryDto\b/);
    expect(content).toMatch(/export interface PaymentSummaryDto\b/);
    expect(content).toMatch(/export interface AccountBalanceDto\b/);
  });
});

describe("C0 — AccountingQueryAdapter file shape (REQ-16, REQ-18)", () => {
  it("adapter file exists", () => {
    expect(existsSync(ADAPTER_PATH)).toBe(true);
  });

  it("declares AccountingQueryAdapter class implementing AccountingQueryPort", () => {
    const content = readFileSync(ADAPTER_PATH, "utf-8");
    expect(content).toMatch(
      /export class AccountingQueryAdapter\s+implements\s+AccountingQueryPort\b/,
    );
  });

  it("constructor takes 5 service deps (journals, ledger, sales, purchases, payments)", () => {
    const content = readFileSync(ADAPTER_PATH, "utf-8");
    expect(content).toMatch(/private readonly journals/);
    expect(content).toMatch(/private readonly ledger/);
    expect(content).toMatch(/private readonly sales/);
    expect(content).toMatch(/private readonly purchases/);
    expect(content).toMatch(/private readonly payments/);
  });

  it("declares LOCAL toMoneyString helper (not exported)", () => {
    const content = readFileSync(ADAPTER_PATH, "utf-8");
    // Must be declared as a non-exported function/const
    expect(content).toMatch(/(^|\n)\s*function toMoneyString\b/);
    // Must NOT export it (transport concern stays adapter-local)
    expect(content).not.toMatch(/export\s+(function|const)\s+toMoneyString\b/);
  });

  it("imports roundHalfUp from accounting/shared/domain/money.utils", () => {
    const content = readFileSync(ADAPTER_PATH, "utf-8");
    expect(content).toMatch(/roundHalfUp/);
    expect(content).toMatch(/money\.utils/);
  });
});
