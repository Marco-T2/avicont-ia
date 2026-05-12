/**
 * RED test — runMemberClerkSaga helper four-branch failure matrix.
 *
 * Expected failure mode at commit time:
 *   `Cannot find module '../member-clerk-saga'` — helper file does not
 *   yet exist. T6 (GREEN) adds it and turns every assertion green.
 *
 * Covers: REQ-MCS.1/2/3 (helper shared by all three operations),
 * REQ-MCS.5 (structured log contract on commit/compensate/divergent).
 *
 * Branches (per design §2):
 *   (a) dbWrite OK + clerkCall OK                 -> logCommitted, return result
 *   (b) dbWrite fails                              -> bubble raw error, no Clerk, no logs
 *   (c) dbWrite OK + clerkCall fails + compensate OK -> ExternalSyncError, logCompensated
 *   (d) dbWrite OK + clerkCall fails + compensate fails -> ExternalSyncError, logDivergent
 *   (e) clerkCall fails + isIdempotentSuccess -> no compensation, logCommitted, return result
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ExternalSyncError } from "@/features/shared/errors";
import * as loggerModule from "../domain/member-clerk-saga.logger";
import { runMemberClerkSaga, type MemberSagaContext } from "../application/member-clerk-saga";

const baseCtx = (): MemberSagaContext => ({
  operation: "add",
  organizationId: "org_1",
  memberId: "placeholder",
  clerkUserId: "user_clerk_1",
  correlationId: "corr-abc",
});

describe("runMemberClerkSaga — branch (a) happy path", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the dbWrite result and emits logCommitted once", async () => {
    const spyCommitted = vi.spyOn(loggerModule, "logCommitted").mockImplementation(() => {});
    const spyCompensated = vi.spyOn(loggerModule, "logCompensated").mockImplementation(() => {});
    const spyDivergent = vi.spyOn(loggerModule, "logDivergent").mockImplementation(() => {});

    const dbWrite = vi.fn().mockResolvedValue({ memberId: "m-1", result: { id: "m-1" } });
    const clerkCall = vi.fn().mockResolvedValue(undefined);
    const compensate = vi.fn();

    const result = await runMemberClerkSaga({
      ctx: baseCtx(),
      dbWrite,
      clerkCall,
      compensate,
      isIdempotentSuccess: () => false,
      divergentState: { dbState: "member_inserted", clerkState: "membership_absent" },
    });

    expect(result).toEqual({ id: "m-1" });
    expect(dbWrite).toHaveBeenCalledOnce();
    expect(clerkCall).toHaveBeenCalledOnce();
    expect(compensate).not.toHaveBeenCalled();
    expect(spyCommitted).toHaveBeenCalledOnce();
    expect(spyCompensated).not.toHaveBeenCalled();
    expect(spyDivergent).not.toHaveBeenCalled();
  });

  it("logCommitted payload carries memberId from dbWrite + operation + correlationId", async () => {
    const spyCommitted = vi.spyOn(loggerModule, "logCommitted").mockImplementation(() => {});
    vi.spyOn(loggerModule, "logCompensated").mockImplementation(() => {});
    vi.spyOn(loggerModule, "logDivergent").mockImplementation(() => {});

    const ctx: MemberSagaContext = {
      operation: "remove",
      organizationId: "org_42",
      memberId: "m-known",
      clerkUserId: "user_clerk_42",
      correlationId: "corr-999",
    };

    await runMemberClerkSaga({
      ctx,
      dbWrite: async () => ({ memberId: "m-known", result: { ok: true } }),
      clerkCall: async () => undefined,
      compensate: async () => undefined,
      isIdempotentSuccess: () => false,
      divergentState: { dbState: "member_deactivated", clerkState: "membership_present" },
    });

    expect(spyCommitted).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "remove",
        organizationId: "org_42",
        memberId: "m-known",
        clerkUserId: "user_clerk_42",
        correlationId: "corr-999",
      }),
    );
  });
});

describe("runMemberClerkSaga — branch (b) dbWrite fails", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("bubbles the original error; Clerk mock never called; no logs", async () => {
    const spyCommitted = vi.spyOn(loggerModule, "logCommitted").mockImplementation(() => {});
    const spyCompensated = vi.spyOn(loggerModule, "logCompensated").mockImplementation(() => {});
    const spyDivergent = vi.spyOn(loggerModule, "logDivergent").mockImplementation(() => {});

    const dbErr = new Error("db down");
    const dbWrite = vi.fn().mockRejectedValue(dbErr);
    const clerkCall = vi.fn().mockResolvedValue(undefined);
    const compensate = vi.fn();

    await expect(
      runMemberClerkSaga({
        ctx: baseCtx(),
        dbWrite,
        clerkCall,
        compensate,
        isIdempotentSuccess: () => false,
        divergentState: { dbState: "x", clerkState: "y" },
      }),
    ).rejects.toBe(dbErr);

    expect(clerkCall).not.toHaveBeenCalled();
    expect(compensate).not.toHaveBeenCalled();
    expect(spyCommitted).not.toHaveBeenCalled();
    expect(spyCompensated).not.toHaveBeenCalled();
    expect(spyDivergent).not.toHaveBeenCalled();
  });
});

describe("runMemberClerkSaga — branch (c) Clerk fails + compensation succeeds", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("throws ExternalSyncError; logCompensated fires; logDivergent does NOT", async () => {
    const spyCommitted = vi.spyOn(loggerModule, "logCommitted").mockImplementation(() => {});
    const spyCompensated = vi.spyOn(loggerModule, "logCompensated").mockImplementation(() => {});
    const spyDivergent = vi.spyOn(loggerModule, "logDivergent").mockImplementation(() => {});

    const clerkErr = new Error("clerk 500");
    const dbWrite = vi.fn().mockResolvedValue({ memberId: "m-1", result: { id: "m-1" } });
    const clerkCall = vi.fn().mockRejectedValue(clerkErr);
    const compensate = vi.fn().mockResolvedValue(undefined);

    let caught: unknown;
    try {
      await runMemberClerkSaga({
        ctx: baseCtx(),
        dbWrite,
        clerkCall,
        compensate,
        isIdempotentSuccess: () => false,
        divergentState: { dbState: "member_inserted", clerkState: "membership_absent" },
      });
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(ExternalSyncError);
    expect((caught as ExternalSyncError).statusCode).toBe(503);
    expect(compensate).toHaveBeenCalledOnce();
    expect(spyCompensated).toHaveBeenCalledOnce();
    expect(spyDivergent).not.toHaveBeenCalled();
    expect(spyCommitted).not.toHaveBeenCalled();
  });

  it("compensation receives the original Clerk error fingerprint on logCompensated payload", async () => {
    vi.spyOn(loggerModule, "logCommitted").mockImplementation(() => {});
    const spyCompensated = vi.spyOn(loggerModule, "logCompensated").mockImplementation(() => {});
    vi.spyOn(loggerModule, "logDivergent").mockImplementation(() => {});

    const clerkErr = new Error("clerk 500");
    await runMemberClerkSaga({
      ctx: baseCtx(),
      dbWrite: async () => ({ memberId: "m-1", result: { id: "m-1" } }),
      clerkCall: async () => {
        throw clerkErr;
      },
      compensate: async () => undefined,
      isIdempotentSuccess: () => false,
      divergentState: { dbState: "member_inserted", clerkState: "membership_absent" },
    }).catch(() => {
      /* expected */
    });

    expect(spyCompensated).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "add",
        clerkError: expect.objectContaining({ code: "non_clerk_error" }),
      }),
    );
  });
});

describe("runMemberClerkSaga — branch (d) double failure (Clerk + compensation)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("throws ExternalSyncError with divergentState; logDivergent fires; logCompensated does NOT", async () => {
    const spyCommitted = vi.spyOn(loggerModule, "logCommitted").mockImplementation(() => {});
    const spyCompensated = vi.spyOn(loggerModule, "logCompensated").mockImplementation(() => {});
    const spyDivergent = vi.spyOn(loggerModule, "logDivergent").mockImplementation(() => {});

    const clerkErr = new Error("clerk 500");
    const compErr = new Error("db down during compensation");

    let caught: ExternalSyncError | undefined;
    try {
      await runMemberClerkSaga({
        ctx: baseCtx(),
        dbWrite: async () => ({ memberId: "m-1", result: { id: "m-1" } }),
        clerkCall: async () => {
          throw clerkErr;
        },
        compensate: async () => {
          throw compErr;
        },
        isIdempotentSuccess: () => false,
        divergentState: { dbState: "member_inserted", clerkState: "membership_absent" },
      });
    } catch (e) {
      caught = e as ExternalSyncError;
    }

    expect(caught).toBeInstanceOf(ExternalSyncError);
    expect(caught!.details).toMatchObject({
      divergentState: { dbState: "member_inserted", clerkState: "membership_absent" },
      operation: "add",
      correlationId: "corr-abc",
    });
    expect(spyDivergent).toHaveBeenCalledOnce();
    expect(spyCompensated).not.toHaveBeenCalled();
    expect(spyCommitted).not.toHaveBeenCalled();
  });

  it("logDivergent payload contains clerkError + compensationError + all required fields (S-MCS.5-3)", async () => {
    vi.spyOn(loggerModule, "logCommitted").mockImplementation(() => {});
    vi.spyOn(loggerModule, "logCompensated").mockImplementation(() => {});
    const spyDivergent = vi.spyOn(loggerModule, "logDivergent").mockImplementation(() => {});

    await runMemberClerkSaga({
      ctx: {
        operation: "remove",
        organizationId: "org_42",
        memberId: "m-42",
        clerkUserId: "user_clerk_42",
        correlationId: "corr-999",
      },
      dbWrite: async () => ({ memberId: "m-42", result: {} }),
      clerkCall: async () => {
        throw new Error("clerk 500");
      },
      compensate: async () => {
        throw new Error("comp down");
      },
      isIdempotentSuccess: () => false,
      divergentState: { dbState: "member_deactivated", clerkState: "membership_present" },
    }).catch(() => {
      /* expected */
    });

    expect(spyDivergent).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "remove",
        organizationId: "org_42",
        memberId: "m-42",
        clerkUserId: "user_clerk_42",
        correlationId: "corr-999",
        dbState: "member_deactivated",
        clerkState: "membership_present",
        clerkError: expect.any(Object),
        compensationError: expect.objectContaining({ name: "Error", message: "comp down" }),
      }),
    );
  });
});

describe("runMemberClerkSaga — branch (e) Clerk idempotent success", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns dbWrite result; logCommitted fires; no compensation", async () => {
    const spyCommitted = vi.spyOn(loggerModule, "logCommitted").mockImplementation(() => {});
    const spyCompensated = vi.spyOn(loggerModule, "logCompensated").mockImplementation(() => {});
    const spyDivergent = vi.spyOn(loggerModule, "logDivergent").mockImplementation(() => {});

    const clerkErr = new Error("duplicate");
    const compensate = vi.fn();

    const result = await runMemberClerkSaga<{ id: string }>({
      ctx: baseCtx(),
      dbWrite: async () => ({ memberId: "m-1", result: { id: "m-1" } }),
      clerkCall: async () => {
        throw clerkErr;
      },
      compensate,
      isIdempotentSuccess: (err) => err === clerkErr,
      divergentState: { dbState: "member_inserted", clerkState: "membership_absent" },
    });

    expect(result).toEqual({ id: "m-1" });
    expect(compensate).not.toHaveBeenCalled();
    expect(spyCommitted).toHaveBeenCalledOnce();
    expect(spyCompensated).not.toHaveBeenCalled();
    expect(spyDivergent).not.toHaveBeenCalled();
  });
});

describe("runMemberClerkSaga — SF-3 (retryAfterSeconds in details, not headers)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("ExternalSyncError.details never exposes a Retry-After header surface", async () => {
    vi.spyOn(loggerModule, "logCommitted").mockImplementation(() => {});
    vi.spyOn(loggerModule, "logCompensated").mockImplementation(() => {});
    vi.spyOn(loggerModule, "logDivergent").mockImplementation(() => {});

    let caught: ExternalSyncError | undefined;
    try {
      await runMemberClerkSaga({
        ctx: baseCtx(),
        dbWrite: async () => ({ memberId: "m-1", result: {} }),
        clerkCall: async () => {
          throw new Error("clerk 500");
        },
        compensate: async () => undefined,
        isIdempotentSuccess: () => false,
        divergentState: { dbState: "member_inserted", clerkState: "membership_absent" },
      });
    } catch (e) {
      caught = e as ExternalSyncError;
    }

    expect(caught).toBeInstanceOf(ExternalSyncError);
    // SF-3: no "Retry-After" or similar header-shaped key allowed on details
    expect(caught!.details).not.toHaveProperty("Retry-After");
    expect(caught!.details).not.toHaveProperty("retry-after");
  });
});
