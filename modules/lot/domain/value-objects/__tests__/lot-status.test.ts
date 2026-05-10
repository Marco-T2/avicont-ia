import { describe, expect, it } from "vitest";
import {
  parseLotStatus,
  canTransitionLot,
  LOT_STATUSES,
} from "../lot-status";
import { InvalidLotStatus } from "../../errors/lot-errors";

describe("LotStatus VO behavioral", () => {
  // α29
  it("parseLotStatus accepts ACTIVE/CLOSED + throws InvalidLotStatus for invalid", () => {
    expect(parseLotStatus("ACTIVE")).toBe("ACTIVE");
    expect(parseLotStatus("CLOSED")).toBe("CLOSED");
    expect(() => parseLotStatus("INVALID")).toThrow(InvalidLotStatus);
  });

  // α30
  it("LOT_STATUSES is readonly tuple [ACTIVE, CLOSED]", () => {
    expect(LOT_STATUSES).toEqual(["ACTIVE", "CLOSED"]);
  });

  // α31
  it("canTransitionLot ACTIVE→CLOSED returns true", () => {
    expect(canTransitionLot("ACTIVE", "CLOSED")).toBe(true);
  });

  // α32
  it("canTransitionLot rejects CLOSED→ACTIVE + CLOSED→CLOSED + ACTIVE→ACTIVE", () => {
    expect(canTransitionLot("CLOSED", "ACTIVE")).toBe(false);
    expect(canTransitionLot("CLOSED", "CLOSED")).toBe(false);
    expect(canTransitionLot("ACTIVE", "ACTIVE")).toBe(false);
  });
});
