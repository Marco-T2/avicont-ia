import { describe, it, expect } from "vitest";
import {
  VoucherType,
  type CreateVoucherTypeInput,
  type VoucherTypeProps,
} from "../voucher-type.entity";
import { VoucherTypeCode } from "../value-objects/voucher-type-code";
import { VoucherTypePrefix } from "../value-objects/voucher-type-prefix";
import {
  InvalidVoucherTypeCodeFormat,
  InvalidVoucherTypePrefixFormat,
} from "../errors/voucher-type-errors";

const baseInput: CreateVoucherTypeInput = {
  organizationId: "org-1",
  code: "CI",
  prefix: "I",
  name: "Comprobante de Ingreso",
};

describe("VoucherType.create", () => {
  it("creates a voucher type with valid input", () => {
    const vt = VoucherType.create(baseInput);
    expect(vt.organizationId).toBe("org-1");
    expect(vt.code).toBe("CI");
    expect(vt.prefix).toBe("I");
    expect(vt.name).toBe("Comprobante de Ingreso");
    expect(vt.id).toBeDefined();
    expect(vt.id.length).toBeGreaterThan(0);
  });

  it("defaults isActive=true and isAdjustment=false", () => {
    const vt = VoucherType.create(baseInput);
    expect(vt.isActive).toBe(true);
    expect(vt.isAdjustment).toBe(false);
  });

  it("respects isAdjustment=true when explicitly passed (seed path for CJ)", () => {
    const vt = VoucherType.create({ ...baseInput, code: "CJ", isAdjustment: true });
    expect(vt.isAdjustment).toBe(true);
  });

  it("defaults description to null when omitted", () => {
    const vt = VoucherType.create(baseInput);
    expect(vt.description).toBeNull();
  });

  it("preserves description when provided", () => {
    const vt = VoucherType.create({
      ...baseInput,
      description: "Registra entrada de dinero",
    });
    expect(vt.description).toBe("Registra entrada de dinero");
  });

  it("rejects malformed code at construction (factory enforces VO invariants)", () => {
    expect(() =>
      VoucherType.create({ ...baseInput, code: "ci" }),
    ).toThrow(InvalidVoucherTypeCodeFormat);
  });

  it("rejects malformed prefix at construction (factory enforces VO invariants)", () => {
    expect(() =>
      VoucherType.create({ ...baseInput, prefix: "II" }),
    ).toThrow(InvalidVoucherTypePrefixFormat);
  });
});

describe("VoucherType.fromPersistence", () => {
  it("reconstructs an entity from persisted props without re-validating", () => {
    const props: VoucherTypeProps = {
      id: "vt-1",
      organizationId: "org-1",
      code: VoucherTypeCode.of("CT"),
      prefix: VoucherTypePrefix.of("T"),
      name: "Traspaso",
      description: null,
      isActive: true,
      isAdjustment: false,
    };
    const vt = VoucherType.fromPersistence(props);
    expect(vt.id).toBe("vt-1");
    expect(vt.code).toBe("CT");
    expect(vt.prefix).toBe("T");
  });

  it("preserves journalEntryCount when included", () => {
    const props: VoucherTypeProps = {
      id: "vt-2",
      organizationId: "org-1",
      code: VoucherTypeCode.of("CI"),
      prefix: VoucherTypePrefix.of("I"),
      name: "Ingreso",
      description: null,
      isActive: true,
      isAdjustment: false,
      journalEntryCount: 42,
    };
    expect(VoucherType.fromPersistence(props).journalEntryCount).toBe(42);
  });
});

describe("VoucherType.rename", () => {
  it("returns a new entity with the updated name", () => {
    const vt = VoucherType.create(baseInput);
    const renamed = vt.rename("Ingreso Reactivo");
    expect(renamed.name).toBe("Ingreso Reactivo");
    expect(renamed.id).toBe(vt.id);
    expect(renamed.code).toBe(vt.code);
  });

  it("does not mutate the original entity", () => {
    const vt = VoucherType.create(baseInput);
    vt.rename("Otro nombre");
    expect(vt.name).toBe("Comprobante de Ingreso");
  });
});

describe("VoucherType.changePrefix", () => {
  it("returns a new entity with the updated prefix", () => {
    const vt = VoucherType.create(baseInput);
    const updated = vt.changePrefix("X");
    expect(updated.prefix).toBe("X");
    expect(updated.code).toBe(vt.code);
  });

  it("rejects malformed prefix", () => {
    const vt = VoucherType.create(baseInput);
    expect(() => vt.changePrefix("XX")).toThrow(InvalidVoucherTypePrefixFormat);
  });
});

describe("VoucherType.updateDescription", () => {
  it("sets a non-null description", () => {
    const vt = VoucherType.create(baseInput);
    expect(vt.updateDescription("nueva").description).toBe("nueva");
  });

  it("clears the description when null is passed", () => {
    const vt = VoucherType.create({ ...baseInput, description: "vieja" });
    expect(vt.updateDescription(null).description).toBeNull();
  });

  it("returns the same description when undefined is passed (no-op)", () => {
    const vt = VoucherType.create({ ...baseInput, description: "vieja" });
    expect(vt.updateDescription(undefined).description).toBe("vieja");
  });
});

describe("VoucherType.deactivate / activate", () => {
  it("deactivate flips isActive to false", () => {
    const vt = VoucherType.create(baseInput);
    expect(vt.deactivate().isActive).toBe(false);
  });

  it("activate flips isActive to true (idempotent on active)", () => {
    const vt = VoucherType.create(baseInput);
    expect(vt.activate().isActive).toBe(true);
  });

  it("activate restores a previously deactivated entity", () => {
    const vt = VoucherType.create(baseInput).deactivate();
    expect(vt.activate().isActive).toBe(true);
  });
});

describe("VoucherType.toSnapshot", () => {
  it("returns a flat plain object with primitive code/prefix", () => {
    const vt = VoucherType.create(baseInput);
    const snap = vt.toSnapshot();
    expect(snap.id).toBe(vt.id);
    expect(snap.code).toBe("CI");
    expect(snap.prefix).toBe("I");
    expect(snap.isActive).toBe(true);
    expect(snap.isAdjustment).toBe(false);
    expect(snap._count).toBeUndefined();
  });

  it("includes _count.journalEntries when journalEntryCount is set", () => {
    const props: VoucherTypeProps = {
      id: "vt-c",
      organizationId: "org-1",
      code: VoucherTypeCode.of("CI"),
      prefix: VoucherTypePrefix.of("I"),
      name: "Ingreso",
      description: null,
      isActive: true,
      isAdjustment: false,
      journalEntryCount: 7,
    };
    const snap = VoucherType.fromPersistence(props).toSnapshot();
    expect(snap._count).toEqual({ journalEntries: 7 });
  });
});

describe("VoucherType — code immutability", () => {
  it("entity exposes no setter for code (TS-level guarantee)", () => {
    const vt = VoucherType.create(baseInput);
    // Type-level enforcement: there is no method named `changeCode` or
    // `setCode`. Runtime guard: any attempt to mutate via Object.assign
    // would still leave `code` untouched because props is private.
    expect("changeCode" in vt).toBe(false);
    expect("setCode" in vt).toBe(false);
  });
});
