/**
 * REQ-33 SCN-33.4 — fallback word-split path.
 *
 * When NO detector fires across the whole input, the chunker must use the
 * existing word-based 500/50 splitter and every emitted chunk has
 * `sectionPath: null`.
 *
 * RED expected failure pre-GREEN: trivially passes once shape is `{content, sectionPath:null}`
 * (current chunker fallback). This file is here to lock the invariant
 * forward (regression guard) when detectors land.
 */

import { describe, it, expect } from "vitest";
import { chunkText } from "../chunking";

describe("REQ-33 SCN-33.4 fallback when no detector fires", () => {
  it("returns word-split chunks with sectionPath: null on unstructured text", () => {
    // 2000 words of plain text — no headers, no numbered codes, no all-caps lines.
    const text = Array.from({ length: 2000 }, (_, i) => `palabra${i}`).join(" ");
    const chunks = chunkText(text);

    expect(chunks.length).toBeGreaterThan(1); // 500/50 split kicks in
    for (const chunk of chunks) {
      expect(chunk.sectionPath).toBeNull();
      expect(chunk.content.length).toBeGreaterThan(0);
    }
  });
});
