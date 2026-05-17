import { describe, it, expect } from "vitest";

/**
 * C3 RED — `MAX_CHAT_TURNS` constant + hard bound 10 (REQ-23).
 *
 * Expected RED failure mode per [[red_acceptance_failure_mode]]:
 *   - ENOENT / "Cannot find module 'chat.constants'" — file does not exist yet.
 *
 * Hard-bound rationale (design D-23): the loop default is 5 (4 tool rounds +
 * 1 final text turn). The hard ceiling at 10 prevents future-someone from
 * cranking the constant into an expensive runaway. The assertion fires at
 * module load — fail-fast, no test-time race window.
 */

describe("REQ-23 — MAX_CHAT_TURNS chat-mode constant + hard bound", () => {
  it("α1: MAX_CHAT_TURNS is exported and a finite positive integer", async () => {
    const mod = await import("../chat.constants");
    const value = mod.MAX_CHAT_TURNS as unknown;
    expect(typeof value).toBe("number");
    expect(Number.isFinite(value as number)).toBe(true);
    expect(Number.isInteger(value as number)).toBe(true);
    expect(value as number).toBeGreaterThan(0);
  });

  it("α2: MAX_CHAT_TURNS default is 5 (locked in design D-23)", async () => {
    const mod = await import("../chat.constants");
    expect(mod.MAX_CHAT_TURNS).toBe(5);
  });

  it("α3: MAX_CHAT_TURNS respects the hard upper bound of 10", async () => {
    const mod = await import("../chat.constants");
    expect(mod.MAX_CHAT_TURNS).toBeLessThanOrEqual(10);
  });

  it("α4: HARD_CAP is exported and equals 10 (assertion contract for SCN-23.3)", async () => {
    const mod = await import("../chat.constants");
    expect(mod.HARD_CAP).toBe(10);
  });

  it("α5: MAX_TURN_FALLBACK_MESSAGE matches the locked Spanish fallback (REQ-23 SCN-23.1)", async () => {
    const mod = await import("../chat.constants");
    expect(mod.MAX_TURN_FALLBACK_MESSAGE).toBe(
      "No pude completar la consulta. Intentá ser más específico.",
    );
  });
});
