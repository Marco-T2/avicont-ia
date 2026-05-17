import { describe, expect, it } from "vitest";
import { SIDEBAR_QA_SURFACE } from "../sidebar-qa.surface";

// SCN-1.1 — sidebar-qa is a read-only Q&A surface; only searchDocuments.

describe("SCN-1.1: sidebar-qa surface bundle", () => {
  it("bundle name is 'sidebar-qa'", () => {
    expect(SIDEBAR_QA_SURFACE.name).toBe("sidebar-qa");
  });

  it("bundle includes searchDocuments", () => {
    expect(SIDEBAR_QA_SURFACE.tools.map((t) => t.name)).toContain(
      "searchDocuments",
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
});
