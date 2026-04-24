import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { logStructured } from "../structured";

describe("logStructured", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("emite una línea JSON a console.warn", () => {
    logStructured({ event: "test_event", foo: "bar" });

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const line = warnSpy.mock.calls[0][0] as string;
    expect(JSON.parse(line)).toEqual({ event: "test_event", foo: "bar" });
  });

  it("normaliza Prisma.Decimal a string con 2 decimales", () => {
    logStructured({ event: "price", amount: new Prisma.Decimal("1234.5") });

    const parsed = JSON.parse(warnSpy.mock.calls[0][0] as string);
    expect(parsed.amount).toBe("1234.50");
  });

  it("normaliza Date a ISO string", () => {
    const d = new Date("2026-03-31T12:00:00.000Z");
    logStructured({ event: "cutoff", date: d });

    const parsed = JSON.parse(warnSpy.mock.calls[0][0] as string);
    expect(parsed.date).toBe("2026-03-31T12:00:00.000Z");
  });

  it("preserva primitives y null sin tocar", () => {
    logStructured({
      event: "mix",
      n: 42,
      s: "text",
      b: true,
      nil: null,
    });

    const parsed = JSON.parse(warnSpy.mock.calls[0][0] as string);
    expect(parsed).toEqual({
      event: "mix",
      n: 42,
      s: "text",
      b: true,
      nil: null,
    });
  });

  it("NO serializa Decimal naivemente (hubiera dado '{}')", () => {
    // Regression guard: JSON.stringify(new Prisma.Decimal(...)) nativo puede
    // producir "{}" dependiendo de la runtime. La normalización lo previene.
    logStructured({ delta: new Prisma.Decimal("500.25") });
    const parsed = JSON.parse(warnSpy.mock.calls[0][0] as string);
    expect(parsed.delta).toBe("500.25");
    expect(parsed.delta).not.toEqual({});
  });
});
