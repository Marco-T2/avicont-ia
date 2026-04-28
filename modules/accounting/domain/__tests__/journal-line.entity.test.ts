import { describe, it, expect } from "vitest";
import { JournalLine } from "../journal-line.entity";
import { LineSide } from "../value-objects/line-side";
import { Money } from "@/modules/shared/domain/value-objects/money";
import { JournalLineZeroAmount } from "../errors/journal-errors";

const baseInput = {
  journalEntryId: "je-1",
  accountId: "acc-1",
  side: LineSide.debit(Money.of(100)),
  order: 0,
};

describe("JournalLine entity", () => {
  describe("create()", () => {
    it("asigna un UUID id", () => {
      const line = JournalLine.create(baseInput);
      expect(line.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    it("preserva los campos requeridos", () => {
      const line = JournalLine.create(baseInput);
      expect(line.journalEntryId).toBe("je-1");
      expect(line.accountId).toBe("acc-1");
      expect(line.side.kind).toBe("DEBIT");
      expect(line.side.amount.equals(Money.of(100))).toBe(true);
      expect(line.order).toBe(0);
    });

    it("crea una línea crédito sin perder el side", () => {
      const line = JournalLine.create({
        ...baseInput,
        side: LineSide.credit(Money.of(250)),
        order: 1,
      });
      expect(line.side.kind).toBe("CREDIT");
      expect(line.side.amount.equals(Money.of(250))).toBe(true);
      expect(line.order).toBe(1);
    });

    it("description y contactId default a null", () => {
      const line = JournalLine.create(baseInput);
      expect(line.description).toBeNull();
      expect(line.contactId).toBeNull();
    });

    it("propaga description y contactId cuando se proveen", () => {
      const line = JournalLine.create({
        ...baseInput,
        description: "Pago en efectivo",
        contactId: "contact-1",
      });
      expect(line.description).toBe("Pago en efectivo");
      expect(line.contactId).toBe("contact-1");
    });

    it("acepta description explícitamente null", () => {
      const line = JournalLine.create({ ...baseInput, description: null });
      expect(line.description).toBeNull();
    });
  });

  describe("fromPersistence()", () => {
    it("hidrata desde props sin re-validar", () => {
      const line = JournalLine.fromPersistence({
        id: "line-x",
        journalEntryId: "je-1",
        accountId: "acc-1",
        side: LineSide.debit(Money.of(100)),
        description: null,
        contactId: null,
        order: 5,
      });
      expect(line.id).toBe("line-x");
      expect(line.order).toBe(5);
      expect(line.side.kind).toBe("DEBIT");
    });
  });

  describe("toSnapshot()", () => {
    it("línea débito → debit > 0, credit === 0", () => {
      const line = JournalLine.create({
        ...baseInput,
        side: LineSide.debit(Money.of(150.25)),
      });
      const snap = line.toSnapshot();
      expect(snap.debit).toBe(150.25);
      expect(snap.credit).toBe(0);
    });

    it("línea crédito → credit > 0, debit === 0", () => {
      const line = JournalLine.create({
        ...baseInput,
        side: LineSide.credit(Money.of(75.5)),
        order: 1,
      });
      const snap = line.toSnapshot();
      expect(snap.credit).toBe(75.5);
      expect(snap.debit).toBe(0);
    });

    it("preserva ids, order, description, contactId", () => {
      const line = JournalLine.create({
        ...baseInput,
        order: 3,
        description: "Notas",
        contactId: "contact-1",
      });
      const snap = line.toSnapshot();
      expect(snap.id).toBe(line.id);
      expect(snap.journalEntryId).toBe("je-1");
      expect(snap.accountId).toBe("acc-1");
      expect(snap.order).toBe(3);
      expect(snap.description).toBe("Notas");
      expect(snap.contactId).toBe("contact-1");
    });

    it("snapshot devuelve numbers para debit y credit (no Money)", () => {
      const line = JournalLine.create(baseInput);
      const snap = line.toSnapshot();
      expect(typeof snap.debit).toBe("number");
      expect(typeof snap.credit).toBe("number");
    });
  });

  describe("I10 — invariantes de línea (vía LineSide)", () => {
    // Failure mode declarado: JournalLineZeroAmount (validation,
    // JOURNAL_LINE_ZERO_AMOUNT). Es imposible construir un LineSide con monto
    // cero, por tanto imposible construir un JournalLine con monto cero.
    it("rechaza monto cero en débito con JournalLineZeroAmount", () => {
      expect(() => LineSide.debit(Money.zero())).toThrow(JournalLineZeroAmount);
    });

    // Failure mode declarado: JournalLineZeroAmount.
    it("rechaza monto cero en crédito con JournalLineZeroAmount", () => {
      expect(() => LineSide.credit(Money.zero())).toThrow(
        JournalLineZeroAmount,
      );
    });

    // Both-sides imposible por construcción — el type system del TS lo
    // previene (kind: "DEBIT" | "CREDIT" exclusivo en LineSide). No hay test
    // runtime porque no hay forma de pasarlo.
  });
});
