import { describe, expect, it } from "vitest";
import { getToolsForSurface } from "../index";

// REQ-10..15 RBAC smoke — per-role expected tool counts AND name sets
// (per design §8: names not just counts, catches silent additions).
//
// Expected sets after F2 (agent-accounting-query-tools) GREEN +
// QA Fix #1 (findAccountsByName + listAccounts):
//   - sidebar-qa × owner    → 9 tools (searchDocuments + 8 accounting)
//   - sidebar-qa × admin    → 9 tools (same as owner)
//   - sidebar-qa × contador → 9 tools (PERMISSIONS_READ covers all 4 resources)
//   - sidebar-qa × cobrador → 3 tools (searchDocuments + listSales + listPayments
//                                       only — denied journal + purchases)
//   - sidebar-qa × member   → 1 tool  (searchDocuments only — denied
//                                       journal + sales + purchases + payments)
//
// Drives REQ-10.2 / 11.2 / 12.2 / 14.2 (journal + purchases absent for
// cobrador) and REQ-13.2 / 15.2 (sales + payments absent for member).

const ALL_8_ACCOUNTING = [
  "listRecentJournalEntries",
  "getAccountMovements",
  "getAccountBalance",
  "findAccountsByName",
  "listAccounts",
  "listSales",
  "listPurchases",
  "listPayments",
] as const;

const FULL_CONTADOR_SET = ["searchDocuments", ...ALL_8_ACCOUNTING] as const;

describe("RBAC sidebar-qa × owner — full 9-tool set", () => {
  it("returns 9 tools including all 8 accounting reads", () => {
    const names = getToolsForSurface({
      surface: "sidebar-qa",
      role: "owner",
    }).map((t) => t.name);
    expect(names.sort()).toEqual([...FULL_CONTADOR_SET].sort());
  });
});

describe("RBAC sidebar-qa × admin — full 9-tool set", () => {
  it("returns 9 tools including all 8 accounting reads", () => {
    const names = getToolsForSurface({
      surface: "sidebar-qa",
      role: "admin",
    }).map((t) => t.name);
    expect(names.sort()).toEqual([...FULL_CONTADOR_SET].sort());
  });
});

describe("RBAC sidebar-qa × contador — full 9-tool set (SCN-10.1, 11.1, 12.1, 13.1, 14.1)", () => {
  it("returns 9 tools — PERMISSIONS_READ covers all 4 resources", () => {
    const names = getToolsForSurface({
      surface: "sidebar-qa",
      role: "contador",
    }).map((t) => t.name);
    expect(names.sort()).toEqual([...FULL_CONTADOR_SET].sort());
  });
});

describe("RBAC sidebar-qa × cobrador — 3 tools (SCN-10.2, 11.2, 12.2, 14.2)", () => {
  it("returns searchDocuments + listSales + listPayments only", () => {
    const names = getToolsForSurface({
      surface: "sidebar-qa",
      role: "cobrador",
    }).map((t) => t.name);
    expect(names.sort()).toEqual(
      ["searchDocuments", "listSales", "listPayments"].sort(),
    );
    // Explicit absence assertions for SCNs 10.2, 11.2, 12.2, 14.2
    expect(names).not.toContain("listRecentJournalEntries");
    expect(names).not.toContain("getAccountMovements");
    expect(names).not.toContain("getAccountBalance");
    expect(names).not.toContain("listPurchases");
    // QA Fix #1 — findAccountsByName + listAccounts are journal:read,
    // cobrador no tiene acceso a journal.
    expect(names).not.toContain("findAccountsByName");
    expect(names).not.toContain("listAccounts");
  });
});

describe("RBAC sidebar-qa × member — 1 tool (SCN-13.2, 15.2)", () => {
  it("returns searchDocuments only — no accounting access", () => {
    const names = getToolsForSurface({
      surface: "sidebar-qa",
      role: "member",
    }).map((t) => t.name);
    expect(names).toEqual(["searchDocuments"]);
    expect(names).not.toContain("listSales");
    expect(names).not.toContain("listPayments");
  });
});
