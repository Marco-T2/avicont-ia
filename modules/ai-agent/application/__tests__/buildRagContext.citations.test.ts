/**
 * REQ-32 — buildRagContext emits citation prefix per snippet.
 *
 * Each formatted snippet starts with `[{documentName}#{sectionPath ?? `chunk ${chunkIndex}`}]`
 * on its own line. This ensures the REQ-25 bypass path (which returns the
 * buildRagContext text directly without LLM rewriting) still carries
 * verifiable citation tokens.
 *
 * Token regex per spec SCN-32.1:
 *   `^\[[^#\n]+#[^\]\n]+\]` — multiline.
 *
 * Expected RED failure mode per [[red_acceptance_failure_mode]]:
 *   - assertion failure: output lacks `[name#section]` prefix lines
 *     (current formatter emits only the snippet quoted with `> `).
 */

import { describe, it, expect } from "vitest";
import { buildRagContext } from "../agent.context";
import type { RagPort, RagResult } from "../../domain/ports/rag.port";

function makeRag(results: RagResult[]): RagPort {
  return { search: async () => results };
}

const CITATION_TOKEN_REGEX = /^\[[^#\n]+#[^\]\n]+\]/m;

describe("REQ-32 — buildRagContext citation prefix per snippet", () => {
  it("SCN-32.1: three results with distinct documentNames produce three citation prefix lines", async () => {
    const results: RagResult[] = [
      {
        content: "Texto del plan",
        score: 0.95,
        metadata: {
          documentId: "d1",
          documentName: "Plan de Cuentas",
          chunkIndex: 0,
          sectionPath: null,
        },
      },
      {
        content: "Texto del reglamento",
        score: 0.9,
        metadata: {
          documentId: "d2",
          documentName: "Reglamento Avícola",
          chunkIndex: 5,
          sectionPath: null,
        },
      },
      {
        content: "Texto del manual",
        score: 0.85,
        metadata: {
          documentId: "d3",
          documentName: "Manual de Bioseguridad",
          chunkIndex: 2,
          sectionPath: null,
        },
      },
    ];

    const out = await buildRagContext(makeRag(results), "org", "iva", "owner");
    const lines = out.split("\n");
    const tokenLines = lines.filter((l) => CITATION_TOKEN_REGEX.test(l));
    expect(tokenLines).toHaveLength(3);
  });

  it("SCN-32.1 α2: sectionPath populated produces `[name#sectionPath]` prefix", async () => {
    const results: RagResult[] = [
      {
        content: "snippet",
        score: 0.95,
        metadata: {
          documentId: "d1",
          documentName: "Plan de Cuentas",
          chunkIndex: 0,
          sectionPath: "Capítulo 1 > Activos",
        },
      },
    ];
    const out = await buildRagContext(makeRag(results), "org", "iva", "owner");
    expect(out).toContain("[Plan de Cuentas#Capítulo 1 > Activos]");
  });

  it("SCN-32.1 α3: null sectionPath falls back to `chunk N`", async () => {
    const results: RagResult[] = [
      {
        content: "snippet",
        score: 0.95,
        metadata: {
          documentId: "d1",
          documentName: "Plan de Cuentas",
          chunkIndex: 7,
          sectionPath: null,
        },
      },
    ];
    const out = await buildRagContext(makeRag(results), "org", "iva", "owner");
    expect(out).toContain("[Plan de Cuentas#chunk 7]");
  });

  it("SCN-32.1 α4: snippet content still rendered after the citation line", async () => {
    const results: RagResult[] = [
      {
        content: "Bs2000 IVA Crédito Fiscal",
        score: 0.95,
        metadata: {
          documentId: "d1",
          documentName: "Plan de Cuentas",
          chunkIndex: 0,
          sectionPath: null,
        },
      },
    ];
    const out = await buildRagContext(makeRag(results), "org", "iva", "owner");
    // The token comes first, then the snippet (still prefixed with `> ` for
    // the quoted-block style — coexistence with existing format).
    const tokenIdx = out.indexOf("[Plan de Cuentas#chunk 0]");
    const snippetIdx = out.indexOf("Bs2000 IVA Crédito Fiscal");
    expect(tokenIdx).toBeGreaterThanOrEqual(0);
    expect(snippetIdx).toBeGreaterThan(tokenIdx);
  });
});
