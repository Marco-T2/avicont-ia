/**
 * T07 RED — audit.classifier
 *
 * Expected failure: Cannot find module '../audit.classifier'. El archivo de
 * producción no existe hasta T08. Cubre los scenarios A3-S1 … A3-S7 del spec
 * más casos exhaustividad y missing-parent-context.
 */
import { describe, it, expect } from "vitest";
import { classify, type ParentContext } from "../audit.classifier";

const NO_PARENT: ParentContext = { kind: "none" };
const JE_MANUAL: ParentContext = { kind: "journal_entries", sourceType: null };
const JE_SALE: ParentContext = { kind: "journal_entries", sourceType: "sale" };
const JE_PURCHASE: ParentContext = {
  kind: "journal_entries",
  sourceType: "purchase",
};

describe("classify — cabeceras operativas siempre directa (A3-S1)", () => {
  it("sales → directa", () => {
    expect(classify("sales", NO_PARENT)).toBe("directa");
  });

  it("purchases → directa", () => {
    expect(classify("purchases", NO_PARENT)).toBe("directa");
  });

  it("payments → directa", () => {
    expect(classify("payments", NO_PARENT)).toBe("directa");
  });

  it("dispatches → directa", () => {
    expect(classify("dispatches", NO_PARENT)).toBe("directa");
  });
});

describe("classify — journal_entries según sourceType (A3-S2, A3-S3)", () => {
  it("journal_entries con sourceType null (manual) → directa", () => {
    expect(classify("journal_entries", JE_MANUAL)).toBe("directa");
  });

  it("journal_entries con sourceType 'sale' (reflejo) → indirecta", () => {
    expect(classify("journal_entries", JE_SALE)).toBe("indirecta");
  });

  it("journal_entries con sourceType 'purchase' → indirecta", () => {
    expect(classify("journal_entries", JE_PURCHASE)).toBe("indirecta");
  });
});

describe("classify — líneas heredan del padre (A3-S4, A3-S5, A3-S6)", () => {
  it("sale_details → directa (padre sales siempre directa)", () => {
    expect(classify("sale_details", NO_PARENT)).toBe("directa");
  });

  it("purchase_details → directa (padre purchases siempre directa)", () => {
    expect(classify("purchase_details", NO_PARENT)).toBe("directa");
  });

  it("journal_lines con padre sourceType null → directa", () => {
    expect(classify("journal_lines", JE_MANUAL)).toBe("directa");
  });

  it("journal_lines con padre sourceType 'purchase' → indirecta", () => {
    expect(classify("journal_lines", JE_PURCHASE)).toBe("indirecta");
  });
});

describe("classify — invariantes de invocación", () => {
  it("journal_entries sin parentContext lanza error", () => {
    expect(() => classify("journal_entries", NO_PARENT)).toThrow(
      /parent context/i,
    );
  });

  it("journal_lines sin parentContext lanza error", () => {
    expect(() => classify("journal_lines", NO_PARENT)).toThrow(
      /parent context/i,
    );
  });
});
