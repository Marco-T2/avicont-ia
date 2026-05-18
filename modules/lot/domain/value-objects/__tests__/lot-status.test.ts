import { describe, expect, it } from "vitest";
import {
  parseLotStatus,
  canTransitionLot,
  LOT_STATUSES,
} from "../lot-status";
import { InvalidLotStatus } from "../../errors/lot-errors";

describe("LotStatus VO behavioral (post-collapse REQ-202)", () => {
  // α29 — binary enum (ACTIVE | INACTIVE) per REQ-202
  it("parseLotStatus accepts ACTIVE/INACTIVE + throws InvalidLotStatus for invalid", () => {
    expect(parseLotStatus("ACTIVE")).toBe("ACTIVE");
    expect(parseLotStatus("INACTIVE")).toBe("INACTIVE");
    expect(() => parseLotStatus("INVALID")).toThrow(InvalidLotStatus);
    // Old CLOSED/SOLD are NOT valid domain inputs anymore — DB-only translated by mapper
    expect(() => parseLotStatus("CLOSED")).toThrow(InvalidLotStatus);
    expect(() => parseLotStatus("SOLD")).toThrow(InvalidLotStatus);
  });

  // α30
  it("LOT_STATUSES is readonly tuple [ACTIVE, INACTIVE]", () => {
    expect(LOT_STATUSES).toEqual(["ACTIVE", "INACTIVE"]);
  });

  // α31
  it("canTransitionLot ACTIVE→INACTIVE returns true", () => {
    expect(canTransitionLot("ACTIVE", "INACTIVE")).toBe(true);
  });

  // α32
  it("canTransitionLot rejects INACTIVE→ACTIVE + INACTIVE→INACTIVE + ACTIVE→ACTIVE", () => {
    expect(canTransitionLot("INACTIVE", "ACTIVE")).toBe(false);
    expect(canTransitionLot("INACTIVE", "INACTIVE")).toBe(false);
    expect(canTransitionLot("ACTIVE", "ACTIVE")).toBe(false);
  });
});
