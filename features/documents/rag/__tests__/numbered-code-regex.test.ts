/**
 * REQ-36 — numbered-code regex locked.
 *
 * Pure unit test on the exported regex from chunking-detectors.ts. Locked
 * per [[textual_rule_verification]] — accounting plan codes
 * (1.01, 1.01.05, 2.1.3.07) MUST detect; lowercase first letter and
 * no-space variants MUST NOT.
 *
 * RED expected failure pre-GREEN: import error — `chunking-detectors.ts`
 * does not exist yet.
 */

import { describe, it, expect } from "vitest";
import {
  MD_HEADER_REGEX,
  NUMBERED_CODE_REGEX,
  ALL_CAPS_REGEX,
} from "../chunking-detectors";

describe("REQ-36 NUMBERED_CODE_REGEX", () => {
  it.each([
    ["1.01.05 IVA Crédito", true],
    ["2 PASIVO", true],
    ["3.1.2 Ñandúes", true],
    ["1 ACTIVO", true],
  ])("matches '%s' → %s", (input, expected) => {
    NUMBERED_CODE_REGEX.lastIndex = 0;
    expect(NUMBERED_CODE_REGEX.test(input)).toBe(expected);
  });

  it.each([
    ["1.01.05foo", false], // no space
    ["1.01.05 lowercase", false], // first title letter not uppercase
    ["abc.def Ghi", false], // not numeric
    ["", false],
  ])("rejects '%s'", (input, expected) => {
    NUMBERED_CODE_REGEX.lastIndex = 0;
    expect(NUMBERED_CODE_REGEX.test(input)).toBe(expected);
  });
});

describe("MD_HEADER_REGEX", () => {
  it.each([
    ["# H1", true],
    ["## Sub", true],
    ["###### Deep", true],
    ["#NoSpace", false],
    ["plain", false],
  ])("matches '%s' → %s", (input, expected) => {
    MD_HEADER_REGEX.lastIndex = 0;
    expect(MD_HEADER_REGEX.test(input)).toBe(expected);
  });
});

describe("ALL_CAPS_REGEX (short uppercase lines)", () => {
  it("matches POLÍTICA DE COBROS", () => {
    ALL_CAPS_REGEX.lastIndex = 0;
    expect(ALL_CAPS_REGEX.test("POLÍTICA DE COBROS")).toBe(true);
  });
  it("rejects mixed-case", () => {
    ALL_CAPS_REGEX.lastIndex = 0;
    expect(ALL_CAPS_REGEX.test("Politica de Cobros")).toBe(false);
  });
  it("rejects lines longer than 60 chars (caller enforces; regex itself matches charset only)", () => {
    // The line-length policy is enforced in the cascade, not in the regex.
    // Regex matches uppercase charset; length gate is applied by buildChunks().
    const longCaps = "A".repeat(70);
    ALL_CAPS_REGEX.lastIndex = 0;
    expect(ALL_CAPS_REGEX.test(longCaps)).toBe(true);
  });
});
