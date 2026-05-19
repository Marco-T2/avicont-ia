import { describe, it, expect } from "vitest";
import {
  selectGlosaAllocations,
  type FormAllocationForGlosa,
} from "../payment-form.glosa-helpers";

const base: FormAllocationForGlosa = {
  checked: true,
  type: "receivable",
  assignedAmount: "100",
  sourceTypeCode: "VG",
  referenceNumber: 99,
  sourceDate: new Date("2026-03-20"),
};

describe("selectGlosaAllocations", () => {
  it("returns empty for empty input", () => {
    expect(selectGlosaAllocations([])).toEqual([]);
  });

  it("excludes unchecked allocations", () => {
    expect(selectGlosaAllocations([{ ...base, checked: false }])).toEqual([]);
  });

  it("excludes allocations with assignedAmount <= 0", () => {
    expect(selectGlosaAllocations([{ ...base, assignedAmount: "0" }])).toEqual([]);
    expect(selectGlosaAllocations([{ ...base, assignedAmount: "" }])).toEqual([]);
  });

  it("excludes payable allocations (COBRO glosa scope only)", () => {
    expect(selectGlosaAllocations([{ ...base, type: "payable" }])).toEqual([]);
  });

  it("maps a VG-coded receivable to a glosa token with stringified referenceNumber", () => {
    expect(selectGlosaAllocations([base])).toEqual([
      {
        sourceTypeCode: "VG",
        referenceNumber: "99",
        sourceDate: new Date("2026-03-20"),
      },
    ]);
  });

  it("preserves null sourceTypeCode (builder fallback to DOC at render time)", () => {
    expect(
      selectGlosaAllocations([{ ...base, sourceTypeCode: null }]),
    ).toEqual([
      {
        sourceTypeCode: null,
        referenceNumber: "99",
        sourceDate: new Date("2026-03-20"),
      },
    ]);
  });

  it("maps null referenceNumber to empty string (builder renders 'VG-')", () => {
    expect(
      selectGlosaAllocations([{ ...base, referenceNumber: null }]),
    ).toEqual([
      {
        sourceTypeCode: "VG",
        referenceNumber: "",
        sourceDate: new Date("2026-03-20"),
      },
    ]);
  });

  it("preserves order of multiple checked receivables", () => {
    const a: FormAllocationForGlosa = { ...base, referenceNumber: 1 };
    const b: FormAllocationForGlosa = { ...base, referenceNumber: 2, sourceTypeCode: "ND" };
    const c: FormAllocationForGlosa = { ...base, referenceNumber: 3, checked: false };
    expect(selectGlosaAllocations([a, b, c])).toEqual([
      { sourceTypeCode: "VG", referenceNumber: "1", sourceDate: base.sourceDate },
      { sourceTypeCode: "ND", referenceNumber: "2", sourceDate: base.sourceDate },
    ]);
  });
});
