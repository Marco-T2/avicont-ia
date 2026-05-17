import { describe, expect, it } from "vitest";
import { SIDEBAR_QA_SURFACE } from "../sidebar-qa.surface";

// SCN-1.1 — sidebar-qa conversational + read-only granja surface.
// Bundle post-cleanup #2026-05-17:
//   [searchDocuments, getLotSummary, listFarms, listLots]
// Las 8 tools contables (listRecentJournalEntries, getAccountMovements,
// getAccountBalance, findAccountsByName, listAccounts, listSales,
// listPurchases, listPayments) fueron removidas — duplicaban las páginas
// dedicadas y la UI exacta es más confiable que la respuesta del LLM.

describe("SCN-1.1: sidebar-qa surface bundle", () => {
  it("bundle name is 'sidebar-qa'", () => {
    expect(SIDEBAR_QA_SURFACE.name).toBe("sidebar-qa");
  });

  it("bundle includes searchDocuments + 3 read-only granja tools", () => {
    expect(SIDEBAR_QA_SURFACE.tools.map((t) => t.name).sort()).toEqual(
      ["searchDocuments", "getLotSummary", "listFarms", "listLots"].sort(),
    );
  });

  it("bundle excludes createExpense", () => {
    expect(SIDEBAR_QA_SURFACE.tools.map((t) => t.name)).not.toContain(
      "createExpense",
    );
  });

  it("bundle excludes logMortality", () => {
    expect(SIDEBAR_QA_SURFACE.tools.map((t) => t.name)).not.toContain(
      "logMortality",
    );
  });

  it("bundle excludes las 8 tools contables retiradas en cleanup #2026-05-17", () => {
    const names = SIDEBAR_QA_SURFACE.tools.map((t) => t.name);
    expect(names).not.toContain("listRecentJournalEntries");
    expect(names).not.toContain("getAccountMovements");
    expect(names).not.toContain("getAccountBalance");
    expect(names).not.toContain("findAccountsByName");
    expect(names).not.toContain("listAccounts");
    expect(names).not.toContain("listSales");
    expect(names).not.toContain("listPurchases");
    expect(names).not.toContain("listPayments");
  });
});
