import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * C0 RED — Domain type `ConversationTurn` (REQ-20).
 *
 * Strategy: file existence + textual export shape grep + hex-purity grep
 * (see paired sister `modules/ai-agent/__tests__/c0-domain-shape.poc-ai-agent-hex.test.ts`
 * — same `readDomainFile` + regex pattern).
 *
 * Expected RED failure mode per [[red_acceptance_failure_mode]]:
 *   - ENOENT: cannot read '@/modules/ai-agent/domain/types/conversation.ts'
 *     (file does not exist pre-GREEN).
 *
 * REQ mapping:
 *   - REQ-20 (port-neutral ConversationTurn union — SCN-20.1 + SCN-20.2)
 */

const ROOT = path.resolve(__dirname, "../../..");
const DOMAIN = path.join(ROOT, "ai-agent/domain");

function domainFile(relative: string): string {
  return path.join(DOMAIN, relative);
}

function readDomainFile(relative: string): string {
  const filePath = domainFile(relative);
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `ENOENT: cannot read '@/modules/ai-agent/domain/${relative}'`,
    );
  }
  return fs.readFileSync(filePath, "utf8");
}

describe("REQ-20 — ConversationTurn domain type (port-neutral)", () => {
  it("SCN-20.1.α1: ConversationTurn type is exported from domain/types/conversation", () => {
    const content = readDomainFile("types/conversation.ts");
    expect(content).toMatch(/export\s+type\s+ConversationTurn/m);
  });

  it("SCN-20.1.α2: UserTurn variant is exported", () => {
    const content = readDomainFile("types/conversation.ts");
    expect(content).toMatch(/export\s+type\s+UserTurn/m);
  });

  it("SCN-20.1.α3: ModelTurn variant is exported", () => {
    const content = readDomainFile("types/conversation.ts");
    expect(content).toMatch(/export\s+type\s+ModelTurn/m);
  });

  it("SCN-20.1.α4: ToolResultTurn variant is exported", () => {
    const content = readDomainFile("types/conversation.ts");
    expect(content).toMatch(/export\s+type\s+ToolResultTurn/m);
  });

  it("SCN-20.1.α5: ConversationTurn union references all 3 variants", () => {
    const content = readDomainFile("types/conversation.ts");
    // Match in any order: union must mention UserTurn, ModelTurn, ToolResultTurn
    expect(content).toMatch(/UserTurn/);
    expect(content).toMatch(/ModelTurn/);
    expect(content).toMatch(/ToolResultTurn/);
  });

  it("SCN-20.1.α6: each variant carries a discriminator `kind` literal", () => {
    const content = readDomainFile("types/conversation.ts");
    expect(content).toMatch(/kind:\s*["']user["']/m);
    expect(content).toMatch(/kind:\s*["']model["']/m);
    expect(content).toMatch(/kind:\s*["']tool_result["']/m);
  });

  it("SCN-20.1.α7: ToolCall is imported from the LLM port (no re-definition)", () => {
    const content = readDomainFile("types/conversation.ts");
    expect(content).toMatch(
      /import\s+(?:type\s+)?\{[^}]*\bToolCall\b[^}]*\}\s+from\s+["'][^"']*llm-provider\.port["']/m,
    );
  });

  // ── Hex purity guard (SCN-20.2): no vendor SDK types in domain ──────────
  it("SCN-20.2.α8: domain/types/conversation does NOT import @google/generative-ai", () => {
    const content = readDomainFile("types/conversation.ts");
    expect(content).not.toMatch(/from\s+["']@google\/generative-ai["']/m);
  });

  it("SCN-20.2.α9: domain/types/conversation does NOT reference 'Content[]' (Gemini vendor type)", () => {
    const content = readDomainFile("types/conversation.ts");
    // The literal vendor type identifier must not leak into the domain file.
    expect(content).not.toMatch(/\bContent\[\]/);
  });
});
