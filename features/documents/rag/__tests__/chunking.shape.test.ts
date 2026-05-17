/**
 * REQ-34 — Chunk return shape
 *
 * The chunker emits `Array<{ content: string, sectionPath: string | null }>`.
 *
 * RED expected failure (pre-GREEN): `chunkText(...)` currently returns
 * `string[]`, so `chunks[0].content` is `undefined` and `'sectionPath' in chunks[0]`
 * is false → both assertions fail with the right reason.
 */

import { describe, it, expect } from "vitest";
import { chunkText } from "../chunking";

describe("REQ-34 chunker return shape", () => {
  it("returns objects with { content: string, sectionPath: string | null }", () => {
    const chunks = chunkText("Hello world. This is some unstructured text.");

    expect(Array.isArray(chunks)).toBe(true);
    expect(chunks.length).toBeGreaterThan(0);

    for (const chunk of chunks) {
      expect(typeof chunk).toBe("object");
      expect(chunk).not.toBeNull();
      expect(typeof chunk.content).toBe("string");
      expect(chunk.content.length).toBeGreaterThan(0);
      expect("sectionPath" in chunk).toBe(true);
      expect(
        chunk.sectionPath === null || typeof chunk.sectionPath === "string",
      ).toBe(true);
    }
  });

  it("emits sectionPath: null when no detector matches (unstructured fallback)", () => {
    const chunks = chunkText("plain words without any structure markers");
    for (const chunk of chunks) {
      expect(chunk.sectionPath).toBeNull();
    }
  });
});
