/**
 * REQ-30 — RagResult.metadata carries documentName + chunkIndex + sectionPath.
 *
 * Type-level + runtime shape assertion. Locks the metadata structure flip from
 * `Record<string, unknown> | undefined` → typed required object. Surfaced as
 * an invariant per [[invariant_collision_elevation]] — breaking change for
 * any future port consumer; SOLE current consumer (`buildRagContext`) is
 * updated atomically in C1.3.
 *
 * Expected RED failure mode per [[red_acceptance_failure_mode]]:
 *   - TypeScript compile error: Property 'documentName' does not exist on
 *     type 'Record<string, unknown> | undefined'. Test asserts the typed
 *     shape at value level too, so even if TS check is bypassed, the assignment
 *     `meta.documentName satisfies string` will fail at compile.
 */

import { describe, it, expect } from "vitest";
import type { RagResult } from "../rag.port";

describe("REQ-30 — RagResult.metadata typed citation fields", () => {
  it("SCN-30.0: metadata requires documentName (string), chunkIndex (number), sectionPath (string|null)", () => {
    const result: RagResult = {
      content: "snippet",
      score: 0.9,
      metadata: {
        documentId: "doc-1",
        documentName: "Plan de Cuentas",
        chunkIndex: 0,
        sectionPath: null,
      },
    };

    // Runtime sanity — fields are present.
    expect(result.metadata.documentName).toBe("Plan de Cuentas");
    expect(result.metadata.chunkIndex).toBe(0);
    expect(result.metadata.sectionPath).toBeNull();

    // Type assertions — these fail at COMPILE if metadata stays
    // Record<string, unknown> | undefined. `satisfies` keeps the literal
    // type narrow so 'string|undefined' from index signature is rejected.
    const documentName: string = result.metadata.documentName;
    const chunkIndex: number = result.metadata.chunkIndex;
    const sectionPath: string | null = result.metadata.sectionPath;
    expect(typeof documentName).toBe("string");
    expect(typeof chunkIndex).toBe("number");
    expect(sectionPath === null || typeof sectionPath === "string").toBe(true);
  });

  it("SCN-30.0 α: sectionPath accepts string value (F2 populates non-null)", () => {
    const result: RagResult = {
      content: "snippet",
      score: 0.8,
      metadata: {
        documentId: "doc-2",
        documentName: "Reglamento Avícola",
        chunkIndex: 3,
        sectionPath: "Capítulo 1 > Sanidad",
      },
    };
    expect(result.metadata.sectionPath).toBe("Capítulo 1 > Sanidad");
  });
});
