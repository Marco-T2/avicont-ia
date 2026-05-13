import { execSync } from "child_process";
import { describe, expect, it } from "vitest";

// ── Cross-cutting gate — REQ-009/REQ-012 ─────────────────────────────────────
// Asserts zero vi.mock factory keys using IvaBooksService|IvaBooksRepository
// legacy class names project-wide.
// Binary PASS/FAIL — NOT counted in the 18α main sentinel.
//
// Pattern: `IvaBooksService: vi.fn` or `IvaBooksRepository: vi.fn` — these
// are actual factory key assignments in vi.mock(..., () => ({ Name: vi.fn() }))
// blocks. JSDoc comments that mention the name alongside "vi.mock" prose text
// are excluded by requiring the colon+space+vi.fn pattern (actual key syntax).

describe("c0-vi-mock-targets gate (REQ-009/REQ-012)", () => {
  it("zero vi.mock factory keys for IvaBooks(Service|Repository) project-wide", () => {
    const result = execSync(
      'git grep -rn "IvaBooks\\(Service\\|Repository\\): vi\\.fn" -- . 2>/dev/null || true',
      { encoding: "utf-8", cwd: process.cwd() }
    ).trim();
    expect(result).toHaveLength(0);
  });
});
