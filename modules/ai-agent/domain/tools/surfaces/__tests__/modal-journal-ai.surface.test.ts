import { describe, expect, it } from "vitest";
import { MODAL_JOURNAL_AI_SURFACE } from "../modal-journal-ai.surface";

// SCN-1.3 — modal-journal-ai is single-turn, single-tool.

describe("SCN-1.3: modal-journal-ai surface bundle", () => {
  it("bundle name is 'modal-journal-ai'", () => {
    expect(MODAL_JOURNAL_AI_SURFACE.name).toBe("modal-journal-ai");
  });

  it("has exactly 1 tool", () => {
    expect(MODAL_JOURNAL_AI_SURFACE.tools).toHaveLength(1);
  });

  it("only tool is parseAccountingOperationToSuggestion", () => {
    expect(MODAL_JOURNAL_AI_SURFACE.tools[0]?.name).toBe(
      "parseAccountingOperationToSuggestion",
    );
  });
});
