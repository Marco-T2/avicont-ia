import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * C1 RED — `LLMQuery` port gains an optional `conversationHistory` field
 * (REQ-21). Backward compat: existing callers (no field) still compile.
 *
 * Strategy: textual grep on the port file — same convention as the paired
 * sister `c0-domain-shape.poc-ai-agent-hex.test.ts` block 1 (α1..α7) and the
 * new `conversation-turn.type.test.ts` (REQ-20).
 *
 * Expected RED failure mode per [[red_acceptance_failure_mode]]:
 *   - α1 + α2 + α3 fail because LLMQuery does NOT yet declare
 *     `conversationHistory?: readonly ConversationTurn[]`.
 */

const ROOT = path.resolve(__dirname, "../../..");
const PORT = path.join(ROOT, "ai-agent/domain/ports/llm-provider.port.ts");

function readPort(): string {
  if (!fs.existsSync(PORT)) {
    throw new Error(
      `ENOENT: cannot read '@/modules/ai-agent/domain/ports/llm-provider.port.ts'`,
    );
  }
  return fs.readFileSync(PORT, "utf8");
}

describe("REQ-21 — LLMQuery accepts optional conversationHistory", () => {
  it("SCN-21.2.α1: LLMQuery declares `conversationHistory?` optional field", () => {
    const content = readPort();
    // Optional marker `?` immediately after the field name.
    expect(content).toMatch(/conversationHistory\?\s*:/m);
  });

  it("SCN-21.2.α2: conversationHistory is typed as readonly ConversationTurn[]", () => {
    const content = readPort();
    expect(content).toMatch(
      /conversationHistory\?\s*:\s*readonly\s+ConversationTurn\[\]/m,
    );
  });

  it("SCN-21.2.α3: ConversationTurn is imported (type) from ../types/conversation", () => {
    const content = readPort();
    expect(content).toMatch(
      /import\s+(?:type\s+)?\{[^}]*\bConversationTurn\b[^}]*\}\s+from\s+["']\.\.\/types\/conversation["']/m,
    );
  });

  // ── Backward compat (SCN-21.1): the existing three required fields are
  //    preserved. If a regression accidentally renames or drops them, this
  //    test catches it before downstream callers break.
  it("SCN-21.1.α4: LLMQuery still declares the existing required fields", () => {
    const content = readPort();
    expect(content).toMatch(/readonly\s+systemPrompt\s*:\s*string/m);
    expect(content).toMatch(/readonly\s+userMessage\s*:\s*string/m);
    expect(content).toMatch(/readonly\s+tools\s*:\s*readonly\s+Tool\[\]/m);
  });
});
