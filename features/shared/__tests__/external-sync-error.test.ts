/**
 * RED test — ExternalSyncError class + EXTERNAL_SYNC_ERROR code constant.
 *
 * Expected failure mode at commit time:
 *   `SyntaxError: The requested module '@/features/shared/errors' does not
 *    provide an export named 'ExternalSyncError'` (and the same for
 *    `EXTERNAL_SYNC_ERROR`). The symbols do not yet exist in
 *    `features/shared/errors.ts`. T3 (GREEN) adds them; all assertions
 *    below turn green.
 *
 * Covers: S-MCS.4-1, S-MCS.4-2, S-MCS.4-3 (REQ-MCS.4 — ExternalSyncError
 * as first-class AppError subclass with statusCode 503 and code registry).
 *
 * SF-3 guard: retryAfterSeconds lives in details (JSON body), not HTTP
 * Retry-After header. handleError integration asserted below.
 */
import { describe, it, expect } from "vitest";
import {
  AppError,
  ExternalSyncError,
  EXTERNAL_SYNC_ERROR,
  type DivergentState,
  type ExternalSyncErrorDetails,
} from "@/features/shared/errors";
import { handleError } from "@/features/shared/http-error-serializer";

describe("ExternalSyncError — S-MCS.4-1 (503 class, code constant)", () => {
  const divergentState: DivergentState = {
    dbState: "member_inserted",
    clerkState: "membership_absent",
  };

  it("extends AppError", () => {
    const err = new ExternalSyncError("sync failed", {
      divergentState,
      operation: "add",
      correlationId: "corr-1",
    });
    expect(err).toBeInstanceOf(AppError);
    expect(err).toBeInstanceOf(Error);
  });

  it("statusCode is 503", () => {
    const err = new ExternalSyncError("sync failed", {
      divergentState,
      operation: "add",
      correlationId: "corr-1",
    });
    expect(err.statusCode).toBe(503);
  });

  it("code is EXTERNAL_SYNC_ERROR", () => {
    const err = new ExternalSyncError("sync failed", {
      divergentState,
      operation: "add",
      correlationId: "corr-1",
    });
    expect(err.code).toBe("EXTERNAL_SYNC_ERROR");
    expect(err.code).toBe(EXTERNAL_SYNC_ERROR);
  });

  it("carries divergentState, operation, correlationId on details", () => {
    const err = new ExternalSyncError("sync failed", {
      divergentState,
      operation: "remove",
      correlationId: "corr-42",
    });
    expect(err.details).toMatchObject({
      divergentState,
      operation: "remove",
      correlationId: "corr-42",
    });
  });
});

describe("ExternalSyncError — S-MCS.4-2 (retryAfterSeconds in details JSON body)", () => {
  const divergentState: DivergentState = {
    dbState: "member_inserted",
    clerkState: "membership_absent",
  };

  it("details.retryAfterSeconds is undefined when not provided", () => {
    const err = new ExternalSyncError("msg", {
      divergentState,
      operation: "add",
      correlationId: "c",
    });
    expect(err.details?.retryAfterSeconds).toBeUndefined();
  });

  it("details.retryAfterSeconds is echoed when provided", () => {
    const err = new ExternalSyncError("msg", {
      divergentState,
      operation: "add",
      correlationId: "c",
      retryAfterSeconds: 30,
    });
    expect(err.details?.retryAfterSeconds).toBe(30);
  });

  it("SF-3 — handleError returns 503 and NO Retry-After HTTP header", async () => {
    const err = new ExternalSyncError("msg", {
      divergentState,
      operation: "add",
      correlationId: "c",
      retryAfterSeconds: 30,
    });
    const response = handleError(err);
    expect(response.status).toBe(503);
    // SF-3 guard: retryAfter travels in JSON body details, NOT HTTP header
    expect(response.headers.get("Retry-After")).toBeNull();
    const body = (await response.json()) as {
      code?: string;
      error?: string;
      details?: { retryAfterSeconds?: number; divergentState?: DivergentState };
    };
    expect(body.code).toBe("EXTERNAL_SYNC_ERROR");
    expect(body.details?.retryAfterSeconds).toBe(30);
    expect(body.details?.divergentState).toEqual(divergentState);
  });
});

describe("ExternalSyncError — S-MCS.4-3 (EXTERNAL_SYNC_ERROR constant)", () => {
  it("constant is the string 'EXTERNAL_SYNC_ERROR'", () => {
    expect(EXTERNAL_SYNC_ERROR).toBe("EXTERNAL_SYNC_ERROR");
  });

  it("ExternalSyncErrorDetails type shape is usable (compile-time check mirrored at runtime)", () => {
    const detailsShape: ExternalSyncErrorDetails = {
      divergentState: {
        dbState: "member_deactivated",
        clerkState: "membership_present",
      },
      operation: "remove",
      correlationId: "c-1",
    };
    expect(detailsShape.operation).toBe("remove");
  });
});

describe("ExternalSyncError — handleError integration (I-5, no route mapping needed)", () => {
  it("serializes message, code and details into 503 response body", async () => {
    const err = new ExternalSyncError("compensation failed", {
      divergentState: {
        dbState: "member_deactivated",
        clerkState: "membership_present",
      },
      operation: "remove",
      correlationId: "corr-xyz",
      clerkErrorCode: "resource_not_found",
      clerkTraceId: "trace_abc",
    });
    const response = handleError(err);
    expect(response.status).toBe(503);
    const body = (await response.json()) as {
      error: string;
      code: string;
      details: ExternalSyncErrorDetails & Record<string, unknown>;
    };
    expect(body.error).toBe("compensation failed");
    expect(body.code).toBe("EXTERNAL_SYNC_ERROR");
    expect(body.details.divergentState.dbState).toBe("member_deactivated");
    expect(body.details.clerkErrorCode).toBe("resource_not_found");
    expect(body.details.correlationId).toBe("corr-xyz");
  });
});
