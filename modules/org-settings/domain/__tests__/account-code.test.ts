import { describe, it, expect } from "vitest";
import { AccountCode } from "../value-objects/account-code";
import { INVALID_ACCOUNT_CODE } from "../errors/org-settings-errors";

describe("AccountCode", () => {
  it("acepta un string non-empty", () => {
    expect(AccountCode.of("1.1.1.1").value).toBe("1.1.1.1");
  });

  it("hace trim del input", () => {
    expect(AccountCode.of("  1.1.1.1  ").value).toBe("1.1.1.1");
  });

  it("rechaza string vacío con INVALID_ACCOUNT_CODE", () => {
    expect(() => AccountCode.of("")).toThrowError(
      expect.objectContaining({ code: INVALID_ACCOUNT_CODE }),
    );
  });

  it("rechaza string que solo contiene whitespace con INVALID_ACCOUNT_CODE", () => {
    expect(() => AccountCode.of("   ")).toThrowError(
      expect.objectContaining({ code: INVALID_ACCOUNT_CODE }),
    );
  });

  it("rechaza valores no string con INVALID_ACCOUNT_CODE", () => {
    expect(() => AccountCode.of(123 as unknown as string)).toThrowError(
      expect.objectContaining({ code: INVALID_ACCOUNT_CODE }),
    );
  });

  it("equals compara por valor", () => {
    expect(AccountCode.of("1.1.1.1").equals(AccountCode.of("1.1.1.1"))).toBe(true);
    expect(AccountCode.of("1.1.1.1").equals(AccountCode.of("1.1.1.2"))).toBe(false);
  });

  it("descendsFrom devuelve true si el code coincide o empieza con `${parent}.`", () => {
    const code = AccountCode.of("1.1.1.5");
    expect(code.descendsFrom(AccountCode.of("1.1.1"))).toBe(true);
    expect(code.descendsFrom(AccountCode.of("1.1.1.5"))).toBe(true); // self
    expect(code.descendsFrom(AccountCode.of("1.1.2"))).toBe(false);
  });

  it("descendsFromAny devuelve true si desciende de al menos uno de los parents", () => {
    const code = AccountCode.of("1.1.2.5");
    expect(
      code.descendsFromAny([AccountCode.of("1.1.1"), AccountCode.of("1.1.2")]),
    ).toBe(true);
    expect(
      code.descendsFromAny([AccountCode.of("1.1.1"), AccountCode.of("1.1.3")]),
    ).toBe(false);
  });
});
