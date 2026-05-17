/**
 * REQ-33 detector cascade — sectionPath population per detector.
 *
 * Cycles in this file accumulate across C2.2..C2.11. Each `describe`
 * pins one detector (or precedence rule, or clip policy).
 *
 * RED expectations are declared per-describe via the "Expected failure"
 * note in the suite header.
 */

import { describe, it, expect } from "vitest";
import { chunkText } from "../chunking";

// ---------------------------------------------------------------------------
// C2.2 — markdown header detector
// Expected failure pre-GREEN: sectionPath stays null for header-prefixed text
// ---------------------------------------------------------------------------

describe("REQ-33 markdown header detector (cascade step 1)", () => {
  it("populates sectionPath from a single H1", () => {
    const chunks = chunkText("# Sección A\nbody line\nmore body");
    const withSection = chunks.find((c) => c.content.includes("body"));
    expect(withSection).toBeDefined();
    expect(withSection!.sectionPath).toBe("Sección A");
  });

  it("nests sectionPath via '>' for hierarchical headers", () => {
    const chunks = chunkText(
      "# H1\nintro\n## H2\ndetail line\n### H3\nleaf body",
    );
    const leaf = chunks.find((c) => c.content.includes("leaf body"));
    expect(leaf).toBeDefined();
    expect(leaf!.sectionPath).toBe("H1 > H2 > H3");
  });

  it("pops the stack when a higher-level header reappears", () => {
    const chunks = chunkText(
      "# A\nbody-a\n## A1\nbody-a1\n# B\nbody-b",
    );
    const a1 = chunks.find((c) => c.content.includes("body-a1"));
    const b = chunks.find((c) => c.content.includes("body-b"));
    expect(a1?.sectionPath).toBe("A > A1");
    expect(b?.sectionPath).toBe("B");
  });
});

// ---------------------------------------------------------------------------
// C2.4 — numbered-code detector
// Expected failure pre-GREEN: numbered line treated as body, sectionPath null
// ---------------------------------------------------------------------------

describe("REQ-33/36 numbered-code detector (cascade step 2)", () => {
  it("captures full code+title as sectionPath leaf", () => {
    const chunks = chunkText(
      "1.01.05 IVA Crédito Fiscal\nsaldo deudor por compras",
    );
    const body = chunks.find((c) => c.content.includes("saldo deudor"));
    expect(body).toBeDefined();
    expect(body!.sectionPath).toBe("1.01.05 IVA Crédito Fiscal");
  });

  it("combines with surrounding markdown ancestors when both fire", () => {
    const chunks = chunkText(
      "# Plan de Cuentas\n1.01 ACTIVO\ndetalle",
    );
    const body = chunks.find((c) => c.content.includes("detalle"));
    expect(body?.sectionPath).toBe("Plan de Cuentas > 1.01 ACTIVO");
  });

  it("rejects lowercase first letter and no-space variants", () => {
    const chunks = chunkText("1.01.05foo\nplain body");
    const body = chunks.find((c) => c.content.includes("plain body"));
    expect(body?.sectionPath).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// C2.6 — all-caps short-line detector
// Expected failure pre-GREEN: all-caps line treated as body
// ---------------------------------------------------------------------------

describe("REQ-33 all-caps detector (cascade step 3)", () => {
  it("populates sectionPath from a short all-caps line", () => {
    const chunks = chunkText("POLÍTICA DE COBROS\ndetalle del proceso");
    const body = chunks.find((c) => c.content.includes("detalle del proceso"));
    expect(body?.sectionPath).toBe("POLÍTICA DE COBROS");
  });

  it("ignores long uppercase lines (>60 chars)", () => {
    const longCaps =
      "ESTA ES UNA LÍNEA EXTREMADAMENTE LARGA QUE NO DEBERÍA SER DETECTADA";
    const chunks = chunkText(`${longCaps}\nbody`);
    const body = chunks.find((c) => c.content.includes("body"));
    expect(body?.sectionPath).toBeNull();
  });

  it("ignores lowercase-mixed lines", () => {
    const chunks = chunkText("Politica de Cobros\nbody-mixed");
    const body = chunks.find((c) => c.content.includes("body-mixed"));
    expect(body?.sectionPath).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// C2.8 — markdown wins over numbered-code (precedence)
// Expected failure pre-GREEN: hybrid line classified as numbered
// ---------------------------------------------------------------------------

describe("REQ-33 detector precedence (SCN-33.1)", () => {
  it("classifies '# 1.01 ACTIVO' as a markdown header (not numbered code)", () => {
    const chunks = chunkText("# 1.01 ACTIVO\ndetalle activo");
    const body = chunks.find((c) => c.content.includes("detalle activo"));
    // markdown captured (just "1.01 ACTIVO" without the '#'), no numbered stomp
    expect(body?.sectionPath).toBe("1.01 ACTIVO");
  });
});

// ---------------------------------------------------------------------------
// C2.10 — sectionPath clip (α-sectionPath-clip sentinel)
// Expected failure pre-GREEN: no clip → sectionPath > 512 chars
// ---------------------------------------------------------------------------

describe("REQ-33 / RESOLVED-4 sectionPath clip (α-sentinel)", () => {
  it("clips paths >512 chars with leading ellipsis", () => {
    const longSegment = "X".repeat(200);
    const text = `# ${longSegment}\n## ${longSegment}\n### ${longSegment}\nbody-leaf`;
    const chunks = chunkText(text);
    const leaf = chunks.find((c) => c.content.includes("body-leaf"));
    expect(leaf).toBeDefined();
    expect(leaf!.sectionPath).not.toBeNull();
    expect(leaf!.sectionPath!.length).toBe(512);
    expect(leaf!.sectionPath!.startsWith("…")).toBe(true);
  });

  it("leaves short paths unclipped (no ellipsis prefix)", () => {
    const chunks = chunkText("# Short\nbody");
    const body = chunks.find((c) => c.content.includes("body"));
    expect(body?.sectionPath).toBe("Short");
    expect(body!.sectionPath!.startsWith("…")).toBe(false);
  });
});
