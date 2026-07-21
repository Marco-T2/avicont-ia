/**
 * ExternalSyncError × handleError integration tests.
 *
 * Moved out of modules/shared/domain/errors/__tests__/external-sync-error.test.ts
 * so the domain test stays free of presentation imports (hex R1). The pure
 * AppError/statusCode/code cases remain in the domain test file.
 *
 * Covers the handleError halves of S-MCS.4-2 (SF-3 guard: retryAfterSeconds in
 * JSON body, not HTTP Retry-After header) and the I-5 serialization contract.
 */
import { describe, it, expect } from "vitest";
import {
  ExternalSyncError,
  type DivergentState,
  type ExternalSyncErrorDetails,
} from "@/modules/shared/domain/errors";
import { handleError } from "@/modules/shared/presentation/http-error-serializer";

describe("ExternalSyncError — S-MCS.4-2 handleError (retryAfterSeconds in details JSON body)", () => {
  const divergentState: DivergentState = {
    dbState: "member_inserted",
    clerkState: "membership_absent",
  };

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
