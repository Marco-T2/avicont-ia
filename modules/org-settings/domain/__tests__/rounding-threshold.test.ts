import { describe, it, expect } from "vitest";
import { RoundingThreshold } from "../value-objects/rounding-threshold";
import { INVALID_ROUNDING_THRESHOLD } from "../errors/org-settings-errors";

describe("RoundingThreshold", () => {
  it("acepta 0 (mínimo del rango)", () => {
    expect(RoundingThreshold.of(0).value).toBe(0);
  });

  it("acepta 1 (máximo del rango)", () => {
    expect(RoundingThreshold.of(1).value).toBe(1);
  });

  it("acepta valores fraccionales en [0, 1]", () => {
    expect(RoundingThreshold.of(0.7).value).toBe(0.7);
    expect(RoundingThreshold.of(0.5).value).toBe(0.5);
  });

  it("rechaza valores < 0 con INVALID_ROUNDING_THRESHOLD", () => {
    expect(() => RoundingThreshold.of(-0.1)).toThrowError(
      expect.objectContaining({ code: INVALID_ROUNDING_THRESHOLD }),
    );
  });

  it("rechaza valores > 1 con INVALID_ROUNDING_THRESHOLD", () => {
    expect(() => RoundingThreshold.of(1.01)).toThrowError(
      expect.objectContaining({ code: INVALID_ROUNDING_THRESHOLD }),
    );
  });

  it("rechaza NaN con INVALID_ROUNDING_THRESHOLD", () => {
    expect(() => RoundingThreshold.of(Number.NaN)).toThrowError(
      expect.objectContaining({ code: INVALID_ROUNDING_THRESHOLD }),
    );
  });

  it("rechaza Infinity con INVALID_ROUNDING_THRESHOLD", () => {
    expect(() => RoundingThreshold.of(Number.POSITIVE_INFINITY)).toThrowError(
      expect.objectContaining({ code: INVALID_ROUNDING_THRESHOLD }),
    );
  });

  it("default() retorna 0.7", () => {
    expect(RoundingThreshold.default().value).toBe(0.7);
  });

  it("equals compara por valor", () => {
    expect(RoundingThreshold.of(0.7).equals(RoundingThreshold.of(0.7))).toBe(true);
    expect(RoundingThreshold.of(0.7).equals(RoundingThreshold.of(0.5))).toBe(false);
  });
});
