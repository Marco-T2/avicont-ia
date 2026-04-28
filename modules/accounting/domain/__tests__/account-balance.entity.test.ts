import { describe, it, expect } from "vitest";
import { AccountBalance } from "../account-balance.entity";
import { LineSide } from "../value-objects/line-side";
import { Money } from "@/modules/shared/domain/value-objects/money";
import { InvalidMonetaryAmount } from "@/modules/shared/domain/errors/monetary-errors";

const baseInput = {
  organizationId: "org-1",
  accountId: "acc-1",
  periodId: "period-1",
  nature: "DEUDORA" as const,
};

describe("AccountBalance aggregate (separate from Journal)", () => {
  describe("create()", () => {
    it("inicializa todos los totales en cero", () => {
      const b = AccountBalance.create(baseInput);
      expect(b.debitTotal.isZero()).toBe(true);
      expect(b.creditTotal.isZero()).toBe(true);
      expect(b.balance).toBe(0);
    });

    it("asigna un UUID id", () => {
      const b = AccountBalance.create(baseInput);
      expect(b.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    it("preserva accountId, periodId, organizationId, nature", () => {
      const b = AccountBalance.create(baseInput);
      expect(b.accountId).toBe("acc-1");
      expect(b.periodId).toBe("period-1");
      expect(b.organizationId).toBe("org-1");
      expect(b.nature).toBe("DEUDORA");
    });
  });

  describe("fromPersistence()", () => {
    it("hidrata desde props sin re-validar", () => {
      const b = AccountBalance.fromPersistence({
        id: "bal-x",
        organizationId: "org-1",
        accountId: "acc-1",
        periodId: "period-1",
        nature: "ACREEDORA",
        debitTotal: Money.of(500),
        creditTotal: Money.of(800),
      });
      expect(b.id).toBe("bal-x");
      expect(b.nature).toBe("ACREEDORA");
      expect(b.debitTotal.equals(Money.of(500))).toBe(true);
      expect(b.creditTotal.equals(Money.of(800))).toBe(true);
    });
  });

  describe("applyLine()", () => {
    it("suma a debitTotal cuando side es DEBIT", () => {
      const b = AccountBalance.create(baseInput).applyLine(
        LineSide.debit(Money.of(100)),
      );
      expect(b.debitTotal.equals(Money.of(100))).toBe(true);
      expect(b.creditTotal.isZero()).toBe(true);
    });

    it("suma a creditTotal cuando side es CREDIT", () => {
      const b = AccountBalance.create(baseInput).applyLine(
        LineSide.credit(Money.of(75)),
      );
      expect(b.creditTotal.equals(Money.of(75))).toBe(true);
      expect(b.debitTotal.isZero()).toBe(true);
    });

    it("acumula múltiples applyLine", () => {
      let b = AccountBalance.create(baseInput);
      b = b.applyLine(LineSide.debit(Money.of(100)));
      b = b.applyLine(LineSide.debit(Money.of(50)));
      b = b.applyLine(LineSide.credit(Money.of(30)));
      expect(b.debitTotal.equals(Money.of(150))).toBe(true);
      expect(b.creditTotal.equals(Money.of(30))).toBe(true);
    });

    it("retorna nueva instancia (inmutable)", () => {
      const b = AccountBalance.create(baseInput);
      const next = b.applyLine(LineSide.debit(Money.of(100)));
      expect(next).not.toBe(b);
      expect(b.debitTotal.isZero()).toBe(true);
    });
  });

  describe("revertLine()", () => {
    it("resta de debitTotal cuando side es DEBIT", () => {
      const b = AccountBalance.create(baseInput).applyLine(
        LineSide.debit(Money.of(100)),
      );
      const reverted = b.revertLine(LineSide.debit(Money.of(40)));
      expect(reverted.debitTotal.equals(Money.of(60))).toBe(true);
    });

    it("resta de creditTotal cuando side es CREDIT", () => {
      const b = AccountBalance.create(baseInput).applyLine(
        LineSide.credit(Money.of(100)),
      );
      const reverted = b.revertLine(LineSide.credit(Money.of(60)));
      expect(reverted.creditTotal.equals(Money.of(40))).toBe(true);
    });

    // Failure mode declarado: InvalidMonetaryAmount (validation,
    // INVALID_MONETARY_AMOUNT). Money rechaza resultados negativos. Si el
    // caller revierte un monto > acumulado, el aggregate detecta inconsistencia.
    it("rechaza revertLine que produce debitTotal negativo", () => {
      const b = AccountBalance.create(baseInput).applyLine(
        LineSide.debit(Money.of(50)),
      );
      expect(() => b.revertLine(LineSide.debit(Money.of(100)))).toThrow(
        InvalidMonetaryAmount,
      );
    });
  });

  describe("balance signed según nature", () => {
    it("DEUDORA: balance = debit - credit (saldo natural positivo)", () => {
      const b = AccountBalance.create({ ...baseInput, nature: "DEUDORA" })
        .applyLine(LineSide.debit(Money.of(100)))
        .applyLine(LineSide.credit(Money.of(40)));
      expect(b.balance).toBe(60);
    });

    it("DEUDORA: balance puede ser negativo (saldo en rojo)", () => {
      const b = AccountBalance.create({ ...baseInput, nature: "DEUDORA" })
        .applyLine(LineSide.debit(Money.of(40)))
        .applyLine(LineSide.credit(Money.of(100)));
      expect(b.balance).toBe(-60);
    });

    it("ACREEDORA: balance = credit - debit (saldo natural positivo)", () => {
      const b = AccountBalance.create({ ...baseInput, nature: "ACREEDORA" })
        .applyLine(LineSide.debit(Money.of(40)))
        .applyLine(LineSide.credit(Money.of(100)));
      expect(b.balance).toBe(60);
    });

    it("ACREEDORA: balance negativo cuando debit > credit", () => {
      const b = AccountBalance.create({ ...baseInput, nature: "ACREEDORA" })
        .applyLine(LineSide.debit(Money.of(100)))
        .applyLine(LineSide.credit(Money.of(40)));
      expect(b.balance).toBe(-60);
    });

    it("balance es cero cuando debit === credit", () => {
      const b = AccountBalance.create(baseInput)
        .applyLine(LineSide.debit(Money.of(100)))
        .applyLine(LineSide.credit(Money.of(100)));
      expect(b.balance).toBe(0);
    });
  });

  describe("toSnapshot()", () => {
    it("retorna POJO con totales y balance signed como números", () => {
      const b = AccountBalance.create({ ...baseInput, nature: "DEUDORA" })
        .applyLine(LineSide.debit(Money.of(100)))
        .applyLine(LineSide.credit(Money.of(40)));
      const snap = b.toSnapshot();
      expect(typeof snap.debitTotal).toBe("number");
      expect(typeof snap.creditTotal).toBe("number");
      expect(typeof snap.balance).toBe("number");
      expect(snap.debitTotal).toBe(100);
      expect(snap.creditTotal).toBe(40);
      expect(snap.balance).toBe(60);
    });

    it("preserva ids y nature", () => {
      const b = AccountBalance.create({
        ...baseInput,
        nature: "ACREEDORA",
      });
      const snap = b.toSnapshot();
      expect(snap.id).toBe(b.id);
      expect(snap.organizationId).toBe("org-1");
      expect(snap.accountId).toBe("acc-1");
      expect(snap.periodId).toBe("period-1");
      expect(snap.nature).toBe("ACREEDORA");
    });

    it("snapshot.balance es negativo en saldo invertido", () => {
      const b = AccountBalance.create({ ...baseInput, nature: "DEUDORA" })
        .applyLine(LineSide.credit(Money.of(50)));
      const snap = b.toSnapshot();
      expect(snap.balance).toBe(-50);
    });
  });
});
