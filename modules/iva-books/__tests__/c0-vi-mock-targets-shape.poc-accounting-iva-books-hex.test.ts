import { execSync } from "child_process";
import { describe, expect, it } from "vitest";

// ── Cross-cutting gate — REQ-009/REQ-012 ─────────────────────────────────────
// Asserts zero actual vi.mock factory key assignments for legacy class names
// IvaBooksService|IvaBooksRepository project-wide. Searches app/ and modules/
// only (excludes this sentinel file from self-match).

describe("c0-vi-mock-targets gate (REQ-009/REQ-012)", () => {
  it("zero vi.mock factory keys for IvaBooks(Service|Repository) project-wide", () => {
    // Grep app/ + modules/ only (excludes this sentinel from self-match).
    // Pattern matches actual factory key assignment syntax: `ClassName: vi.fn`
    const result = execSync(
      "git grep -rn \"IvaBooks\\(Service\\|Repository\\): vi\\.fn\" -- app/ modules/ components/ 2>/dev/null || true",
      { encoding: "utf-8", cwd: process.cwd() }
    ).trim();
    expect(result).toHaveLength(0);
  });
});
