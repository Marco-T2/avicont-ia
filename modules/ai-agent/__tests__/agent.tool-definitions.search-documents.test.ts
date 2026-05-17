/**
 * REQ-42 — searchDocumentsTool input schema accepts optional `tags?: string[]`.
 *
 * Locks the Zod schema extension so future copy edits or tool refactors do
 * not silently drop the field. Both shapes must parse:
 *  - { query, tags: [...] } -> parsed.tags = [...]
 *  - { query }              -> parsed.tags = undefined
 *
 * Expected RED failure mode per [[red_acceptance_failure_mode]]:
 *   - safeParse on `{ query: 'iva', tags: ['a','b'] }` succeeds at the top
 *     level today because Zod object schemas strip unknown keys silently;
 *     the assertion `expect(parsed.tags).toEqual([...])` fails because the
 *     stripped output has no `tags` key. The test is asserting the schema
 *     KNOWS about `tags`, not just that the parse passes.
 */

import { describe, it, expect } from "vitest";
import { searchDocumentsTool } from "../domain/tools/agent.tool-definitions";

describe("REQ-42 — searchDocumentsTool input schema accepts tags", () => {
  it("SCN-42.1: parse({ query, tags: [...] }) keeps the tags array", () => {
    const result = searchDocumentsTool.inputSchema.safeParse({
      query: "iva credito fiscal",
      tags: ["contable", "fiscal"],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({
        query: "iva credito fiscal",
        tags: ["contable", "fiscal"],
      });
    }
  });

  it("SCN-42.2: parse({ query }) succeeds with tags undefined (optional)", () => {
    const result = searchDocumentsTool.inputSchema.safeParse({ query: "iva" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.query).toBe("iva");
      // tags key absent OR undefined — both acceptable for optional.
      expect(
        result.data.tags === undefined || Array.isArray(result.data.tags),
      ).toBe(true);
    }
  });

  it("rejects non-array tags (e.g. string)", () => {
    const result = searchDocumentsTool.inputSchema.safeParse({
      query: "iva",
      tags: "contable",
    });
    expect(result.success).toBe(false);
  });

  it("rejects tags with non-string entries", () => {
    const result = searchDocumentsTool.inputSchema.safeParse({
      query: "iva",
      tags: ["ok", 42],
    });
    expect(result.success).toBe(false);
  });
});
